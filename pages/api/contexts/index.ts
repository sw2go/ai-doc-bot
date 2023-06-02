import { PROTECTED_CONTEXTS } from "@/config/runtimeSettings";
import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import { CONTEXT_FILE_EXTENSION, CTX_DIR, PINECONE_INDEX_NAME } from "@/config/serverSettings";
import { ContextSettings } from "@/utils/contextSettings";
import { DocVectorStore } from "@/utils/docVectorStore";
import { pinecone } from "@/utils/pinecone-client";
import { validateSecret } from "@/utils/validateSecret";
import { getDirectoryEntries } from "@/utils/helpers";
import { ContextInfo, ContextInit } from "@/types/api";

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) {
  switch(req.method?.toLowerCase()) {
    case 'get':
      return await getContexts(req, res);

    case 'post':
      return await addContext(req, res);
      
    case 'delete':
      return await deleteContexts(req, res);

    default:
      return res.status(404).json({ error: "invalid method"});
  }
};

const getContexts = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {

  try {

    const { type } = req.query as { type: string };

    let result: ContextInfo[] = [];
    let publicContexts: ContextInfo[] = [];

    if (type != '1') {  // extract contextNames from the filenames
      const dirEntries = await getDirectoryEntries(CTX_DIR);      
      publicContexts = dirEntries
        .filter(x => x.isFile() && x.name.endsWith(CONTEXT_FILE_EXTENSION))
        .map(x => x.name.substring(0, x.name.length - CONTEXT_FILE_EXTENSION.length))
        .filter(x => !PROTECTED_CONTEXTS.some(n => n == x))
        .map(x => {return { name: x, type: 2 }})
    }

    switch (type) {
      case '1': // protected contexts only
        result = PROTECTED_CONTEXTS.map(x => {return { name: x, type: 1 }});  
        break;

      case '2': // public contexts only
        result = publicContexts;
        break;

      default:  // all contexts
        result = PROTECTED_CONTEXTS.map(x => {return { name: x, type: 1 }});
        result.push(... publicContexts);
    }

    return res.status(200).send(result);

  } catch (error: any) {
    console.log(error);
    return res.status(400).json({
      error: error.message
    });
  }
}

const addContext = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {

    const context = req.body as ContextInit;

    if (!/^[-äöüéàè\w^&'@{}[\],$=!#().%+~ ]+$/.test(context.name)) {
      throw new Error('Invalid character in contextName');
    }

    ContextSettings.Add(context.name, context.mode);

    const info: ContextInfo = {
      name: context.name,
      type: PROTECTED_CONTEXTS.some(x => x == context.name) ? 1 : 2
    }

    res.status(201).send(info);

  } catch(error: any) {
    return res.status(400).send({
      error: error.message
    });
  }
}

const deleteContexts = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {

    const { type } = req.query as { type: string };

    validateSecret(req, '');  // unconditional secret check

    if (type == '2') {

      // Delete all public files
      const files = await getDirectoryEntries(CTX_DIR);
      files.forEach(file => {
        if (file.isFile() && !PROTECTED_CONTEXTS.some(x => x == file.name.substring(0, file.name.length - CONTEXT_FILE_EXTENSION.length)))
        {
          fs.unlinkSync(`${CTX_DIR}/${file.name}`);                
        }
      });  

      // Clear all public namespaces
      const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
      const namespaces = await vectorStore.getNamespaces();
      namespaces.filter(x => !PROTECTED_CONTEXTS.some(r => r == x)).forEach(async (namespace) => {
        const { before, after } = await vectorStore.clear(namespace);
      });

      return res.status(204).send(null);

    } else {
      return res.status(400).send({
        error: "Invalid query-parameter"        
      });
    }

  } catch(error: any) {
    return res.status(400).send({
      error: error.message
    });
  }
}


