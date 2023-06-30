import type { NextApiRequest, NextApiResponse } from 'next';
import { makeQAChain, TokenSource } from '@/utils/makeQAChain';
import { BaseContextSettings, ChatSettings, ContextSettings, DefaultQAContext, QAContextSettings } from '@/utils/contextSettings';
import { BaseChain } from 'langchain/chains';
import { Chat } from '@/types/api';
import { CsvLog } from '@/utils/csvLog';

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

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

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

  try {

    sendData(JSON.stringify({ data: '' }));

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
            sendData(JSON.stringify({ data: token }));
            return;
          case TokenSource.QuestionGenerator:
            generatedQuestion += token;
            sendData(JSON.stringify({ data: `**Im Kontext des Chat-Verlaufs verstehe ich die Frage so:** ${token}\n\n\n` }));
            return;
          case TokenSource.Error:  
            chatLog(`Error: ${token}`);
            sendData(JSON.stringify({ data: `Oops - da ist ein Fehler passiert!\n\nException: ${token}\n\nBitte laden sie die Seite neu und versuchen Sie es noch einmal.`}));
            sendData('[DONE]');
            res.end();
            return;
          case TokenSource.Timeout:
            chatLog(`Timeout: ${token}`);
            sendData(JSON.stringify({ data: `Oha lätz! OpenAI ist sehr beschäftigt und antwortet nicht.\n\nException: ${token}\n\nBitte versuchen Sie es noch einmal.`}));
            sendData('[DONE]');
            res.end();
            return;
        }      
      });

    } else {
      throw new Error('Invalid context.mode');
    }

    //Ask a question
    const response = await chain?.call({
      question: sanitizedQuestion,
      chat_history: chat.history || []
    });
    //console.log('history:  ', (chat.history || []).length);
    //console.log('question: ', sanitizedQuestion);
    //console.log('response: ', response?.text);
    sendData(JSON.stringify({ sourceDocs: response?.sourceDocuments }));

    //console.log(JSON.stringify(response));

    await chatLog(response?.text);

    // await CsvLog.append(
    //   req.headers['x-client-ip']?.toString() || '',
    //   req.headers['user-agent'] || '',
    //   chat.session || '',
    //   chat.contextName,
    //   chat.maxTokens || 0,
    //   chat.promptTemperature || 0,
    //   (chat.history || []).length,
    //   chat.promptId || 0,
    //   sanitizedQuestion,
    //   generatedQuestion,
    //   response?.text,
    //   context
    // );

  } catch (error: any) {

    await chatLog(error.message);

    // await CsvLog.append(
    //   req.headers['x-client-ip']?.toString() || '',
    //   req.headers['user-agent'] || '',
    //   chat.session || '',
    //   chat.contextName,
    //   chat.maxTokens || 0,
    //   chat.promptTemperature || 0,
    //   (chat.history || []).length,
    //   chat.promptId || 0,
    //   sanitizedQuestion,
    //   generatedQuestion,
    //   error.message,
    //   {}
    // );

    sendData(JSON.stringify({ data: `Oje - da ist ein Fehler passiert!\n\nException: ${error.message}\n\nBitte laden sie die Seite neu und versuchen Sie es noch einmal.`}));

  } finally {
    sendData('[DONE]');
    res.end();
  }
}
