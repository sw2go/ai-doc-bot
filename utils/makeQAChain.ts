import { OpenAIChat } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { PromptTemplate } from 'langchain/prompts';
import { BaseCallbackHandler, ConsoleCallbackHandler, NewTokenIndices } from 'langchain/callbacks';
import { PINECONE_INDEX_NAME } from '@/config/serverSettings';
import { QAContextSettings } from './contextSettings';
import { pinecone } from './pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { LLMResult } from 'langchain/schema';
import { TimeoutCallbackHandler } from './timeoutCallbackHandler';
import { getChatHistoryMessages, getPrompt, TokenSource } from  './makeChainHelper';
import { countTokens } from './countToken';
import { ServerStorage } from './serverStorage';
import { CustomRetriever } from './customRetriever';

/**
 * Prerequisit:
 * -  A vector-database that has been ingested with embeddings
 * 
 * 
 * 1. Given is the user-question and the chat-history
 *    <= question, chat-history
 * 
 * 2. If chat-history > 0 generate a new question based on the chat-history and the user-question
 *    => post preprompt(user-question, chat-history) to openai/.../completions
 *    <= question 
 * 
 * 3. With the question create it's embedding
 *    => post question to openai/.../embeddings
 *    <= embedding
 * 
 * 4. With the embedding fetch the semantically nearest n text-chunks from the vector-database.
 *    => post n and the embedding to pinecone/.../query
 *    <= n text-chunks
 * 
 * 5. Generate a answer by using the question and the found text-chunks as context
 *    => post prompt(question, context) to openai/.../completions
 *    <= response
 * 
 */

export const makeQAChain = async (
  contextSettings: QAContextSettings,
  history: [string, string][],
  question: string,
  abortController: AbortController,
  onTokenStream: (tokenType: TokenSource, token: string) => void,
) => {

  // If Index is missing try to restore it form the Collections
  if (!(await pinecone.listIndexes()).includes(PINECONE_INDEX_NAME)) {
    if ((await pinecone.listCollections()).includes(PINECONE_INDEX_NAME)) {
      await pinecone.createIndex({
        createRequest: {
          name: PINECONE_INDEX_NAME,
          dimension: 1536,
          metric: 'cosine',
          pods: 1,
          podType: 's1.x1',
          sourceCollection: PINECONE_INDEX_NAME,
        }
      });
    }
  }

  const index = pinecone.Index(PINECONE_INDEX_NAME);
  
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      namespace: contextSettings.contextName,
    },
  );

  const prePrompt = getPrompt(contextSettings.prepromptId, contextSettings.preprompts);
  const prompt = getPrompt(contextSettings.promptId, contextSettings.prompts);

  const timeoutHandler = new TimeoutCallbackHandler(contextSettings.timeout, () => { 
    onTokenStream(TokenSource.Timeout, 'OpenAI timeout');
  });

  const generatedQuestionHandler = BaseCallbackHandler.fromMethods({
    handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string) {
      onTokenStream(TokenSource.QuestionGenerator, `${output.generations[0][0].text}`);
    }
  });

  const defaultNewTokenHandler = BaseCallbackHandler.fromMethods({
    handleLLMNewToken(token: string, idx: NewTokenIndices, runId: string, parentRunId?: string) {
      onTokenStream(TokenSource.Default, token);
    }
  });

  const errorHandler = BaseCallbackHandler.fromMethods({
    handleLLMError(err: any, runId: string, parentRunId?: string) {
      onTokenStream(TokenSource.Error, err.message);
    }  
  });

  
  const qaModel = new OpenAIChat({
    topP: 1,
    stop: undefined,
    temperature: contextSettings.promptTemperature,
    modelName: contextSettings.modelName, //  'gpt-3.5-turbo'  'gpt-4'
    maxTokens: contextSettings.maxTokens,
    streaming: true,
    callbacks: [
      timeoutHandler,
      defaultNewTokenHandler,
      errorHandler,
      //new ConsoleCallbackHandler()
    ]
  });

  const questionGeneratorModel = new OpenAIChat({
    topP: 1,
    stop: undefined,
    temperature: contextSettings.prepromptTemperature,
    modelName: contextSettings.modelName, //  'gpt-3.5-turbo'  'gpt-4'
    maxTokens: contextSettings.maxTokens,
    streaming: true,
    callbacks: [
      timeoutHandler,
      generatedQuestionHandler,
      errorHandler,
      //new ConsoleCallbackHandler()
    ]
  });


  // ev mal ContextualCompressionRetriever probieren
  //const retriever = vectorStore.asRetriever(contextSettings.numberSource)
  const retriever = new CustomRetriever(vectorStore, contextSettings.numberSource);

  const chain = ConversationalRetrievalQAChain.fromLLM(
    qaModel, 
    retriever,
    {
      questionGeneratorChainOptions: {
        llm: questionGeneratorModel,
        template: prePrompt
      },
      qaChainOptions: {
        type: 'stuff',
        prompt: PromptTemplate.fromTemplate(prompt)
      },
      returnSourceDocuments: contextSettings.returnSource
    }
  );

  const store = new ServerStorage(3600); 

  let prePromptCount = await store.GetCreateItem<number>(prePrompt, () => countTokens(prePrompt));
  let questionCount = await store.GetCreateItem<number>(question, () => countTokens(question));

  //console.log(`model:${contextSettings.modelTokens} max:${contextSettings.maxTokens} prompt:${prePromptCount} quest:${questionCount}` );

  let remainingTokens = contextSettings.modelTokens - contextSettings.maxTokens - prePromptCount - questionCount;

  const chat_history = await getChatHistoryMessages(history, remainingTokens);
  
  return await chain?.call({
    question: question,
    chat_history: chat_history,
    signal: abortController.signal
  });

};



