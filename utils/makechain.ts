import { OpenAIChat } from 'langchain/llms';
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores';
import { PromptTemplate } from 'langchain/prompts';
import { CallbackManager } from 'langchain/callbacks';
import { NEXT_PUBLIC_CONTEXTS } from '@/config/contexts';
import { PINECONE_INDEX_NAME, RESERVED_FILE_EXTENSIONS, UPLOAD_FOLDER } from '@/config/pinecone';
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

const fetchPrompt = (idx: number, namespace: string | undefined) => {
  let prompt: string = '';
  const filePath = `${UPLOAD_FOLDER}/${namespace}${RESERVED_FILE_EXTENSIONS[idx]}`;
  try {
    if (fs.existsSync(filePath)) {
      prompt = fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    console.log('loading prompt failed: ' + filePath);
  }

  if (prompt.length > 0) {
    // prompt from file
    console.log('prompt loaded: ' + filePath);
    return PromptTemplate.fromTemplate(prompt);
  } else if (idx === 1) {

    // default preprompt for all subjects
    prompt = `Gegeben ist die folgende Unterhaltung und eine Folgefrage. Formuliere die Folgefrage um, so dass sie eine eigenständige Frage wird.

    Chat-Verlauf:
    {chat_history}
    Folgefrage: {question}
    Eigenständige Frage:`
  } else if (NEXT_PUBLIC_CONTEXTS[0] == namespace) {

    // default prompt for first subject
    prompt = `Du bist ein KI-Assistent. Du hilfst beim Erstellen von Marketing Texten für Kunden und Interessenten von ${NEXT_PUBLIC_CONTEXTS[0]}.  
    Im Kontext bekommst du einzelne Texte aus einem längeren Dokument das von ${NEXT_PUBLIC_CONTEXTS[0]} geschrieben ist.
    Beantworte die Frage konversationsbasiert und verwende dazu den bereitgestellten Kontext und andere Quellen zu den Themen IT und Individualsoftwareentwicklung.
    Bitte erfinde keine Hyperlinks.
      
    Frage: {question}
    =========
    {context}
    =========
    Antworte in Markdown:`
  } else {

    // default additional subject prompt
    prompt = `Du bist ein KI-Assistent. Im context bekommst du einzelne Texte aus einem oder mehreren längeren Dokumenten.
    Beantworte die Frage konversationsbasiert und verwende dazu den context.
    Bitte erfinde keine Hyperlinks.
      
    Frage: {question}
    =========
    {context}
    =========
    Antworte in Markdown:`
  }
  return PromptTemplate.fromTemplate(prompt);
}