import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { PINECONE_INDEX_NAME } from '@/config/serverSettings';
import { DirectoryLoader, TextLoader } from 'langchain/document_loaders';
import { DocVectorStore } from '@/utils/docVectorStore';
import { EDITABLE_CONTEXTS, READONLY_CONTEXTS } from '@/config/runtimeSettings';

/* Name of directory to retrieve your files from */
const filePath = 'docs';

const INGEST_SCRIPT_NAMESPACE = [... READONLY_CONTEXTS, ... EDITABLE_CONTEXTS ][0];

/**
 * run when developping to ingest with all the txt and pdf files in the docs folder
 */
export const run = async () => {
  try {

    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));

    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new CustomPDFLoader(path),
      '.txt': (path) => new TextLoader(path)
    });

    const rawDocs = await directoryLoader.load();

    await vectorStore.clear(INGEST_SCRIPT_NAMESPACE);
    await vectorStore.upsert(INGEST_SCRIPT_NAMESPACE, rawDocs);

  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
