import { OpenAIChat } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { PromptTemplate } from 'langchain/prompts';
import { BaseCallbackHandler, NewTokenIndices } from 'langchain/callbacks';
import { PINECONE_INDEX_NAME } from '@/config/serverSettings';
import { QAContextSettings } from './contextSettings';
import { pinecone } from './pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { LLMResult } from 'langchain/dist/schema';

export const makeQAChain = async (
  contextSettings: QAContextSettings,
  promptId: number | undefined,
  onTokenStream: (tokenType: TokenSource, token: string) => void,
) => {

  let timeout: NodeJS.Timeout | null = setTimeout(() => {
    if (timeout) {
      timeout = null;
      onTokenStream(TokenSource.Timeout, 'timeout');
    }
  }, contextSettings.timeout * 1000);

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

  // const questionGenerator = new LLMChain({
  //   llm: new OpenAIChat({ 
  //     temperature: contextSettings.prepromptTemperature,
  //     streaming: true,
  //     callbackManager: onTokenStream 
  //     ? CallbackManager.fromHandlers({
  //       async handleLLMStart(llm, prompts, verbose) {
  //         timeout?.refresh();
  //         //console.log( JSON.stringify({llm, prompts}) );
  //       },        
  //       async handleLLMNewToken(token) {
  //         timeout?.refresh();
  //       },
  //       async handleLLMEnd (output: LLMResult, runId: string, parentRunId?: string) {
  //         timeout?.refresh();
  //         onTokenStream(TokenSource.QuestionGenerator, `${output.generations[0][0].text}`);
  //       },            
  //       async handleLLMError(err: Error, runId: string, parentRunId?: string) {
  //         timeout = null;
  //         onTokenStream(TokenSource.Error, JSON.stringify({err}));
  //       }        
  //     })
  //     : undefined,
  //   }),
  //   prompt: PromptTemplate.fromTemplate(prePrompt),
  // });

  const timeoutHandler = BaseCallbackHandler.fromMethods({
    handleLLMStart(llm, prompts) {
      timeout?.refresh();    
    },  
    handleLLMNewToken(token: string, idx: NewTokenIndices) {
      timeout?.refresh();
    },
    handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string) {
      timeout = null;
    },  
    handleLLMError(err: Error, runId: string, parentRunId?: string) {
      timeout = null;
    }
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
    handleLLMError(err: Error, runId: string, parentRunId?: string) {
      onTokenStream(TokenSource.Error, JSON.stringify({err}));
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
