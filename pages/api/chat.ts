import type { NextApiRequest, NextApiResponse } from 'next';
import { makeChain } from '@/utils/makechain';
import { BaseContextSettings, ContextSettings, QAContextSettings } from '@/utils/contextSettings';
import { BaseChain } from 'langchain/chains';
import { Chat } from '@/types/api';

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

    
    let chain: BaseChain | null = null;
    const context = ContextSettings.Get(chat.contextName);

    if (context?.mode == 'OpenAI-QA') {

      const qaContextSettings = context as QAContextSettings;
      qaContextSettings.contextName = chat.contextName;
      if (chat.maxTokens) { qaContextSettings.maxTokens = chat.maxTokens;}
      if (chat.promptTemperature) { qaContextSettings.promptTemperature = chat.promptTemperature;}
  
      //create chain
      chain = await makeChain(qaContextSettings, chat.promptId, (token: string) => {
        sendData(JSON.stringify({ data: token }));
      });
    }

    //Ask a question
    const response = await chain?.call({
      question: sanitizedQuestion,
      chat_history: chat.history || [],
    });
    console.log('history:  ', (chat.history || []).length);
    console.log('question: ', sanitizedQuestion);
    console.log('response: ', response?.text);
    sendData(JSON.stringify({ sourceDocs: response?.sourceDocuments }));

  } catch (error: any) {
    sendData(JSON.stringify({ data: `Oops - something went wrong!\n\nException: ${error.message}\n\nPlease reload the page and try again.`}));
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
