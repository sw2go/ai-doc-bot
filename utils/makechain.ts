import { OpenAIChat } from 'langchain/llms';
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores';
import { PromptTemplate } from 'langchain/prompts';
import { CallbackManager } from 'langchain/callbacks';
import { PINECONE_INDEX_NAME } from '@/config/serverSettings';
import fs from 'fs'
import { QAContextSettings } from './contextSettings';
import { pinecone } from './pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings';

export const makeChain = async (
  contextSettings: QAContextSettings,
  onTokenStream?: (token: string) => void,
) => {
  const index = pinecone.Index(PINECONE_INDEX_NAME);
    
  /* create vectorstore*/
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      namespace: contextSettings.contextName,
    },
  );

  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({ temperature: contextSettings.prepromptTemperature }),
    prompt: PromptTemplate.fromTemplate(contextSettings.preprompt.join('\n')),
  });

  const docChain = loadQAChain(
    new OpenAIChat({
      temperature: contextSettings.promptTemperature,
      modelName: contextSettings.modelName, //  'gpt-3.5-turbo'  'gpt-4'        change this to older versions (e.g. gpt-3.5-turbo) if you don't have access to gpt-4
      maxTokens: contextSettings.maxTokens,
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream
        ? CallbackManager.fromHandlers({
            async handleLLMNewToken(token) {
              onTokenStream(token);
            },
          })
        : undefined,
    }),
    { prompt: PromptTemplate.fromTemplate(contextSettings.prompt.join('\n')) },  // 'normal' prompt
  );

  return new ChatVectorDBQAChain({
    vectorstore: vectorStore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: contextSettings.returnSource,
    k: contextSettings.numberSource, //number of source documents to return, 
  });
};
