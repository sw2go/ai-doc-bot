import { PROTECTED_CONTEXTS } from "@/config/runtimeSettings";
import { CONTEXT_FILE_EXTENSION, CTX_DIR, PINECONE_INDEX_NAME } from "@/config/serverSettings";
import { NextApiRequest, NextApiResponse } from "next";
import formidable, {File} from "formidable";
import fs from "fs";
import { BaseContextSettings, ContextSettings } from "@/utils/contextSettings";
import { validateSecret } from "@/utils/validateSecret";
import { DocVectorStore } from "@/utils/docVectorStore";
import { pinecone } from "@/utils/pinecone-client";
import { parseForm } from "@/utils/helpers";
import { ContextInfo } from "@/types/api";

// Disabling bodyParser is essential for file upload
// See: nextjs API Routes, custom config 
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) {

  const acceptValue = req.headers['accept'];

  switch(req.method?.toLowerCase()) {
    case 'get':
      if (acceptValue == 'application/json') {
        return await getContextJson(req, res);
      } else {
        return await getContextFile(req, res);
      }
    case 'put':
      return await setContextFile(req, res);

    case 'delete':
      return await deleteContext(req, res);

    default:
      return res.status(404).json({ error: "Invalid method"});
  }
};

const getContextJson = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    const { contextName } = req.query as { contextName: string };

    const filePath = `${CTX_DIR}/${contextName}${CONTEXT_FILE_EXTENSION}`;

    ContextSettings.Check(contextName);

    const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!ContextSettings.ValidateBaseSchema(settings)) 
    {
      throw(new Error('Invalid base schema'));
    }

    const info: ContextInfo = {
      name: contextName,
      type: PROTECTED_CONTEXTS.some(x => x == contextName) ? 1 : 2
    }
    
    return res.status(200).send(info);

  } catch (error: any) {
    res.status(404).send({
      error: error.message
    })
  }
}

const getContextFile = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    const { contextName } = req.query as { contextName: string };
    
    const filePath = `${CTX_DIR}/${contextName}${CONTEXT_FILE_EXTENSION}`;

    ContextSettings.Check(contextName);

    //Set the proper headers, create a read stream and pipe to the response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${Math.floor( Date.now() / 1000 )}-${contextName}${CONTEXT_FILE_EXTENSION}`);  
    fs.createReadStream(filePath).pipe(res);

  } catch (error: any) {
    res.status(404).send({
      error: error.message
    })
  }
}

const setContextFile = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  let fileInfos: File[] = [];
  try {  
    const { contextName } = req.query as { contextName: string };

    const filePath = `${CTX_DIR}/${contextName}${CONTEXT_FILE_EXTENSION}`;
      
    validateSecret(req, contextName);
        
    const form = new formidable.IncomingForm({ uploadDir: CTX_DIR, keepExtensions: false });

    const { fields, files } = await parseForm(req, form);

    // get ctx-files info
    fileInfos = Object.keys(files).map(key => files[key] as File);

    if (fileInfos.length != 1) {      
      throw new Error("only one file is allowed");
    }

    const item = fileInfos[0];

    const o = JSON.parse(fs.readFileSync(item.filepath,'utf8'));

    if (!ContextSettings.Validate(o)) {            
      throw new Error("invalid json");
    } else {
      (o as BaseContextSettings).contextName = contextName;   // ensure correct contextName
      const text = JSON.stringify(o, null, 2);                // ensure pretty json
      fs.writeFileSync(filePath, text, 'utf8');           
    }
    
    return res.status(201).json({
      data: {
        contextName,
        files: fileInfos.map(item => item.originalFilename),
        text: `${fileInfos.length} config uploaded`
      }
    });

  } catch(error: any) {
    return res.status(400).json({
      error: error.message
    });
  } finally {
    fileInfos.forEach(item => fs.unlinkSync(item.filepath));
  }
};

const deleteContext = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    const { contextName } = req.query as { contextName: string };
    const filePath = `${CTX_DIR}/${contextName}${CONTEXT_FILE_EXTENSION}`;

    validateSecret(req, contextName);

    if (contextName?.length > 0) {
      if (fs.existsSync(filePath)) {

        // Delete file
        fs.unlinkSync(filePath);

        // clear vector
        const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
        const { before, after } = await vectorStore.clear(contextName);

        return res.status(204).send(null);
      } else {
        throw new Error("Context not found");
      }
    } else {
      throw new Error("Invalid contextName");
    }
  } catch (error: any) {
    res.status(400).send({
      error: error.message
    })
  }
}
