import { OpenAIChat } from 'langchain/llms';
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores';
import { PromptTemplate } from 'langchain/prompts';
import { CallbackManager } from 'langchain/callbacks';
import { PINECONE_INDEX_NAME } from '@/config/serverSettings';
import { QAContextSettings } from './contextSettings';
import { pinecone } from './pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { LLMResult } from 'langchain/dist/schema';

export const makeChain = async (
  contextSettings: QAContextSettings,
  promptId: number | undefined,
  onTokenStream?: (tokenType: TokenSource, token: string) => void,
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

  const getPrompt = (startId: number | undefined, prompts: string[][]) => {
    let pid = (startId && startId >= 0) ? (prompts.length > startId) ? startId : prompts.length -1 : 0;
    while(pid > 0 && prompts[pid].length == 0) {
      pid--;
    }
    console.log('using promptId:', pid);
    return prompts[pid].join('\n');
  }

  const prePrompt = getPrompt(promptId, contextSettings.preprompts);
  const prompt = getPrompt(promptId, contextSettings.prompts);

  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({ 
      temperature: contextSettings.prepromptTemperature,
      streaming: true,
      callbackManager: onTokenStream 
      ? CallbackManager.fromHandlers({
        async handleLLMStart(llm, prompts, verbose) {
          console.log( JSON.stringify({llm, prompts})      );
        },
        async handleLLMEnd (output: LLMResult, verbose) {
          onTokenStream(TokenSource.QuestionGenerator, `${output.generations[0][0].text}`)
        }
      })
      : undefined,
    }),
    prompt: PromptTemplate.fromTemplate(prePrompt),
  });

  const docChain = loadQAChain(
    new OpenAIChat({
      topP: 1,
      stop: undefined,
      temperature: contextSettings.promptTemperature,
      modelName: contextSettings.modelName, //  'gpt-3.5-turbo'  'gpt-4'        change this to older versions (e.g. gpt-3.5-turbo) if you don't have access to gpt-4
      maxTokens: contextSettings.maxTokens,
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream
        ? CallbackManager.fromHandlers({
            async handleLLMNewToken(token) {
              onTokenStream(TokenSource.Default, token);
            },
          })
        : undefined,
    }),
    { prompt: PromptTemplate.fromTemplate(prompt) },  // 'normal' prompt
  );

  return new ChatVectorDBQAChain({
    vectorstore: vectorStore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: contextSettings.returnSource,
    k: contextSettings.numberSource, //number of source documents to return, 
  });
};


export enum TokenSource {
  Default = 0,
  QuestionGenerator = 1
}
