import type { NextApiRequest, NextApiResponse } from 'next';
import { makeQAChain, TokenSource } from '@/utils/makeQAChain';
import { BaseContextSettings, ChatSettings, ContextSettings, DefaultQAContext, QAContextSettings } from '@/utils/contextSettings';
import { BaseChain } from 'langchain/chains';
import { Chat } from '@/types/api';
import { CsvLog } from '@/utils/csvLog';
import { BaseChatMessage, HumanChatMessage, AIChatMessage } from 'langchain/schema'

const FOLLOWUP_RESPONSE_PREFIX = '**Im Kontext des Chat-Verlaufs verstehe ich die Frage so:** ';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  
  const chat = req.body as Chat;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  // const sendData = (data: string) => {
  //   res.write(`data: ${data}\n\n`);
  // };

  let sanitizedQuestion = '';
  let generatedQuestion = '';
  let context: BaseContextSettings | {} = {};

  const chatLog = async (response: string) => {
    await CsvLog.append(
      req.headers['x-client-ip']?.toString() || '',
      req.headers['user-agent'] || '',
      chat.session || '',
      chat.contextName,
      chat.maxTokens || 0,
      chat.promptTemperature || 0,
      (chat.history || []).length,
      chat.promptId || 0,
      sanitizedQuestion,
      generatedQuestion,
      response,
      context
    );
  }

  // Client abort exception handling -> abort chain as well
  const chainAbortController = new AbortController();  
  const clientRequestAbortedHandler = (err: Error) => {
    if (err.message == 'aborted') {
      chainAbortController.abort();
    }
  }

  try {

    sendObject(res, { data: '' });

    if (!chat.question) {
      throw new Error('No question in the request');
    }
      
    sanitizedQuestion = chat.question.trim().replaceAll('\n', ' ');  // OpenAI recommends replacing newlines with spaces for best results
    
    let chain: BaseChain | null = null;

    // get settings object from file
    context = ContextSettings.Get(chat.contextName);  

    // get partial settings from client (to overwrite)
    const contextfromClient = JSON.parse(JSON.stringify({ // stringify & parse to remove undefined values, in next step undefined must not overwrite default values
      contextName: chat.contextName, 
      promptTemperature: chat.promptTemperature, 
      maxTokens: chat.maxTokens} as ChatSettings));

    if ((context as BaseContextSettings)?.mode == 'OpenAI-QA') {

      // now that we know we need QASettings 
      // we take it's default, overwrite with settings from file, overwrite with settings from client
      const qaContextSettings = Object.assign(DefaultQAContext(''), context, contextfromClient) as QAContextSettings;
      context = qaContextSettings;  // reassign context to have everything in the log as well
      chat.maxTokens = qaContextSettings.maxTokens;
      chat.promptTemperature = qaContextSettings.prepromptTemperature;
    
      //create chain
      chain = await makeQAChain(qaContextSettings, chat.promptId, ( tokenType: TokenSource, token: string ) => {  
        switch(tokenType) {
          case TokenSource.Default:
            sendObject(res, { data: token });
            return;
          case TokenSource.QuestionGenerator:
            generatedQuestion += token;
            sendObject(res, { data: `${FOLLOWUP_RESPONSE_PREFIX}${token}\n\n\n` });
            return;
          case TokenSource.Error:  
            chatLog(`Error: ${token}`);
            sendObject(res, { data: `**Oops!** Da ist ein Fehler passiert.\n\nException: ${token}\n\nBitte laden sie die Seite neu und versuchen Sie es noch einmal.`});
            sendDone(res);
            return;
          case TokenSource.Timeout:
            chatLog(`Timeout: ${token}`);
            sendObject(res, { data: `**Oha lätz!** Der Server ist sehr beschäftigt und antwortet nicht.\n\nException: ${token}\n\nBitte versuchen Sie es noch einmal.`});
            sendDone(res);
            return;
        }      
      });

    } else {
      throw new Error('Invalid context.mode');
    }

    process.once('uncaughtException', clientRequestAbortedHandler);
    
    const response = await chain?.call({
      question: sanitizedQuestion,
      chat_history: createChatMessages(chat.history),
      signal: chainAbortController.signal
    });

    await chatLog(response?.text);
    sendObject(res, { sourceDocs: response?.sourceDocuments });

  } catch (error: any) {

    await chatLog(error.message);
    sendObject(res, { data: `**Oje!**Da ist ein Fehler passiert!\n\nException: ${error.message}\n\nBitte laden sie die Seite neu und versuchen Sie es noch einmal.`});

  } finally {
    process.off('uncaughtException', clientRequestAbortedHandler);      // unwire process event handler
    sendDone(res);
  }
}

const sendObject = (res: NextApiResponse, obj: any) => {
  const data = JSON.stringify(obj);
  res.write(`data: ${data}\n\n`);
};

const sendDone = (res: NextApiResponse) => {
  res.write(`data: [DONE]\n\n`);
  res.end();
};




const createChatMessages = (history: [string,string][]) => {
  let result: BaseChatMessage[] = [];
  (history || []).forEach(hist => {
      result.push(new HumanChatMessage(hist[0]));

      if (hist[1].startsWith(FOLLOWUP_RESPONSE_PREFIX)) {
        let valu = hist[1].substring(FOLLOWUP_RESPONSE_PREFIX.length);
        result.push(new AIChatMessage(valu));
      } else {
        result.push(new AIChatMessage(hist[1]));
      }        
  });
  return result;
}
