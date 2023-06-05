import formidable, {File} from "formidable";
import fs from "fs";
import { DocVectorStore } from "@/utils/docVectorStore";
import { pinecone } from "@/utils/pinecone-client";
import { PINECONE_INDEX_NAME, WORKING_DIR } from "@/config/serverSettings";
import { NextApiRequest, NextApiResponse } from "next";
import { validateSecret } from "@/utils/validateSecret";
import { parseForm } from "@/utils/helpers";
import { VectorInfo } from "@/types/api";

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) {
  switch(req.method?.toLowerCase()) {
    case 'get':
      return await getVectorsCount(req, res);

    case 'post':
      return await addVectors(req, res);  // File Upload

    case 'delete':
      return await deleteVectors(req, res);

    default:
      return res.status(404).json({ error: "invalid method"});
  }
};

// Disabling bodyParser is essential for file upload
// See: nextjs API Routes, custom config 
export const config = {
  api: {
    bodyParser: false
  }
};

const getVectorsCount = async (  
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) => {
    const { contextName } = req.query as { contextName: string };

    try {
      const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));

      const info: VectorInfo = {
        change: 0,
        vectorCount: await vectorStore.count(contextName)
      }

      return res.status(200).send(info);

    } catch(error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
}


const addVectors = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  let fileInfos: null | File[] = null ;

  try {
    
    const { contextName } = req.query as { contextName: string };

    validateSecret(req, contextName);
    
    const form = new formidable.IncomingForm({ uploadDir: WORKING_DIR, keepExtensions: true });
  
    // rename uploading QA-Docs files to it's original name (to have meaningful sourcefile names when displaying references)
    form.on('fileBegin', (name: string, file: File) => {
      file.filepath = file.filepath.replace(file.newFilename, file.originalFilename as string);     
      console.log('up', file.filepath);
    });

    const { fields, files } = await parseForm(req, form);

    // get file infos
    fileInfos = Object.keys(files).map(key => files[key] as File);

    // add docfiles to vector store
    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));        
    const { before, after } = await vectorStore.add(contextName, fileInfos.map(item => item.filepath));

    const info: VectorInfo = {
      change: after - before,
      vectorCount: after
    }

    return res.status(201).json(info);
    
  } catch(error: any) {
    return res.status(400).json({
      error: error.message
    });
  } finally {
    if (fileInfos) {  // cleanup: remove all uploaded files
      fileInfos.forEach(item => fs.unlinkSync(item.filepath));
    }
  }
};

const deleteVectors = async (
  req: NextApiRequest, 
  res: NextApiResponse 
) => {
  try {

    const { contextName } = req.query as { contextName: string };

    validateSecret(req, contextName);

    // clear vector
    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
    const { before, after } = await vectorStore.clear(contextName);

    const info: VectorInfo = {
      change: after - before,
      vectorCount: after
    }
  
    return res.status(201).json(info);

  } catch (error: any) {
    return res.status(500).json({
      error: error.message
    });
  }
};





