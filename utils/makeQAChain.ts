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

export const makeQAChain = async (
  contextSettings: QAContextSettings,
  promptId: number | undefined,
  onTokenStream: (tokenType: TokenSource, token: string) => void,
) => {

  const index = pinecone.Index(PINECONE_INDEX_NAME);
    
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      namespace: contextSettings.contextName,
    },
  );

  const getPrompt = (startId: number | undefined, prompts: string[][]) => {
    let pid = (startId && startId >= 0) ? (prompts.length > startId) ? startId : prompts.length -1 : 0;
    while(pid > 0 && prompts[pid].length == 0) {
      pid--;
    }
    // console.log('using promptId:', pid);
    return prompts[pid].join('\n');
  }

  const prePrompt = getPrompt(promptId, contextSettings.preprompts);
  const prompt = getPrompt(promptId, contextSettings.prompts);

  const timeoutHandler = new TimeoutCallbackHandler(contextSettings.timeout, () => { 
    onTokenStream(TokenSource.Timeout, 'OpenAI timeout');
  });

  const generatedQuestionHandler = BaseCallbackHandler.fromMethods({
    async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string) {
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
      errorHandler
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
      errorHandler
      //new ConsoleCallbackHandler()
    ]
  });

  return ConversationalRetrievalQAChain.fromLLM(
    qaModel, 
    vectorStore.asRetriever(contextSettings.numberSource),
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
    })
};


export enum TokenSource {
  Default = 0,
  QuestionGenerator = 1,
  Error = 2,
  Timeout = 3
}
