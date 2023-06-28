import type { NextApiRequest, NextApiResponse } from 'next';
import { makeChain, TokenSource } from '@/utils/makechain';
import { ContextSettings, QAContextSettings } from '@/utils/contextSettings';
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

  try {

    sendData(JSON.stringify({ data: '' }));

    if (!chat.question) {
      throw new Error('No question in the request');
    }
    
    const sanitizedQuestion = chat.question.trim().replaceAll('\n', ' ');  // OpenAI recommends replacing newlines with spaces for best results
    let generatedQuestion = '';

    let chain: BaseChain | null = null;
    const context = ContextSettings.Get(chat.contextName);

    if (context?.mode == 'OpenAI-QA') {

      const qaContextSettings = context as QAContextSettings;
      qaContextSettings.contextName = chat.contextName;
      if (chat.maxTokens) { 
        qaContextSettings.maxTokens = chat.maxTokens;
      } else {
        chat.maxTokens = qaContextSettings.maxTokens;
      }
      if (chat.promptTemperature) { 
        qaContextSettings.promptTemperature = chat.promptTemperature;
      } else {
        chat.promptTemperature = qaContextSettings.promptTemperature;
      }

      //create chain
      chain = await makeChain(qaContextSettings, chat.promptId, ( tokenType: TokenSource, token: string ) => {  
        switch(tokenType) {
          case TokenSource.Default:
            sendData(JSON.stringify({ data: token }));
            return;
          case TokenSource.QuestionGenerator:
            generatedQuestion += token;
            sendData(JSON.stringify({ data: `**Im Kontext des Chat-Verlaufs verstehe ich die Frage so:** ${token}\n\n\n` }));
            return;
        }      
      });
    }

    //Ask a question
    const response = await chain?.call({
      question: sanitizedQuestion,
      chat_history: chat.history || [],
    });
    //console.log('history:  ', (chat.history || []).length);
    //console.log('question: ', sanitizedQuestion);
    //console.log('response: ', response?.text);
    sendData(JSON.stringify({ sourceDocs: response?.sourceDocuments }));

    //console.log(JSON.stringify(response));

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
      response?.text,
      context
    );

  } catch (error: any) {
    sendData(JSON.stringify({ data: `Oops - something went wrong!\n\nException: ${error.message}\n\nPlease reload the page and try again.`}));
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
