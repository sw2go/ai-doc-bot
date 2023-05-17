import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, CONTEXT_FILE_EXTENSION, UPLOAD_FOLDER } from '@/config/serverSettings';
import fs from 'fs'
import { BaseContextSettings, ContextSettings, QAContextSettings } from '@/utils/contextSettings';
import { BaseChain } from 'langchain/chains';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  let chain: BaseChain | null = null;

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');  // OpenAI recommends replacing newlines with spaces for best results

  const contextName = req.headers['x-context-name'] as string;

  const context = ContextSettings.Create(contextName);

  if (context.type == 'OpenAI-QA') {

    const qaContextSettings = context as QAContextSettings;

    //create chain
    chain = await makeChain(qaContextSettings, (token: string) => {
      sendData(JSON.stringify({ data: token }));
    });

  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  sendData(JSON.stringify({ data: '' }));

  try {
    //Ask a question
    const response = await chain?.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });
    console.log('question: ', sanitizedQuestion);
    console.log('response: ', response?.text);
    sendData(JSON.stringify({ sourceDocs: response?.sourceDocuments }));
  } catch (error) {
    console.log('error', error);
  } finally {
    sendData('[DONE]');
    res.end();
  }

}
