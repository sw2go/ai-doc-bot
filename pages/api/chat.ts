import type { NextApiRequest, NextApiResponse } from 'next';
import { makeQAChain } from '@/utils/makeQAChain';
import { BaseContextSettings, ChatSettings, ContextSettings, DefaultQAContext, QAContextSettings } from '@/utils/contextSettings';
import { Chat } from '@/types/api';
import { CsvLog } from '@/utils/csvLog';
import { GENERATED_QUESTION_RESPONSE_PREFIX, TokenSource } from '@/utils/makeChainHelper';
import { ServerStorage } from '@/utils/serverStorage';

const sorryMsg = "Jetzt ist mir die Frage entfallen.\n\nBitte versuchen Sie es noch einmal."

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

    process.once('uncaughtException', clientRequestAbortedHandler);

    sendObject(res, { data: '' });

    if (!chat.question) {
      throw new Error('No question in the request');
    }
      
    sanitizedQuestion = chat.question.trim().replaceAll('\n', ' ');  // OpenAI recommends replacing newlines with spaces for best results

    // get ContextSettings object from file
    context = ContextSettings.Get(chat.contextName);
  
    if ((context as BaseContextSettings)?.mode == 'OpenAI-QA') {

      // we take only defined partial QAContextSettings from the client
      const partialContext = JSON.parse(JSON.stringify({ // stringify & parse removes properties with undefined values
        promptTemperature: chat.promptTemperature,
        promptId: chat.promptId,
        maxTokens: chat.maxTokens,
        } as QAContextSettings)
      );

      // Initially, the default settings are applied. Then 'partial' values from the file and then from the client are taken over. 
      const qaContextSettings = Object.assign(DefaultQAContext(''), context, partialContext) as QAContextSettings;
      
      context = qaContextSettings;  // reassign context to have everything in the log as well
      chat.maxTokens = qaContextSettings.maxTokens;
      chat.promptTemperature = qaContextSettings.prepromptTemperature;
    
      //create and call the chain
      const response = await makeQAChain(
        qaContextSettings,
        chat.history || [],
        sanitizedQuestion,
        chainAbortController,
        (tokenType: TokenSource, token: string) => {  
        switch(tokenType) {
          case TokenSource.Default:
            sendObject(res, { data: token });
            return;
          case TokenSource.QuestionGenerator:
            generatedQuestion += token;
            sendObject(res, { data: `${GENERATED_QUESTION_RESPONSE_PREFIX}${token}\n\n\n` });
            return;
          case TokenSource.Error:  
            chatLog(`Error: ${token}`);
            sendObject(res, { data: `**Oops!** ${sorryMsg}`});
            sendDone(res);
            return;
          case TokenSource.Timeout:
            chatLog(`Timeout: ${token}`);
            sendObject(res, { data: `**Oha lätz!** ${sorryMsg}`});
            sendDone(res);
            return;
        }      
      });

      await chatLog(response?.text);
      sendObject(res, { sourceDocs: response?.sourceDocuments });

    } else {
      throw new Error('Invalid context.mode');
    }
    
  } catch (error: any) {
    await chatLog(error.message);
    if (error.message?.startsWith("PineconeClient")) {
      sendObject(res, { data: `😴 Erwischt! Mein Grosshirn ist tief eingeschlafen. Bitte versuchen Sie es in einer Minute nochmals.`});
    } else {
      sendObject(res, { data: `**Oje!** ${sorryMsg}`});
    }
    
  } finally {
    process.off('uncaughtException', clientRequestAbortedHandler);      // unwire process event handler
    sendDone(res);
    const serverStorage = new ServerStorage();
    await serverStorage.removeExpiredItems();
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

