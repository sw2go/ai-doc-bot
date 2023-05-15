import formidable, {File} from "formidable";
import fs from "fs";
import { DocVectorStore } from "@/utils/docVectorStore";
import { pinecone } from "@/utils/pinecone-client";
import { PINECONE_INDEX_NAME, RESERVED_FILE_EXTENSIONS, UPLOAD_FOLDER, CONTEXT_FILE_EXTENSION } from "@/config/serverSettings";
import { NEXT_PUBLIC_READONLY_CONTEXTS,  } from "@/config/clientSettings";
import { NextApiRequest, NextApiResponse } from "next";
import { ContextSettings } from "@/utils/contextSettings";
import { Validator } from "jsonschema";

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) {

  switch(req.method?.toLowerCase()) {
    case 'get':
      const {context} = req.query;
      if (context) {
        return await getFile(req, res);
      } else {
        return await getVectorCount(req, res);
      };
      
    case 'post':
      return await uploadFiles(req, res);

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

const getVectorCount = async (  
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) => {
    try {
      const contextName = req.headers['x-context-name'] as string;
      const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
      const count = await vectorStore.count(contextName);
      return res.status(200).json({
        data: {
          contextName,
          before: count,
          after: count
        }
      });
    } catch(error: any) {
      return res.status(201).json({
        error: error.message
      });
    }
}

const getFile = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    const {context} = req.query;

    const settings = ContextSettings.Create(context as string);

    const text = JSON.stringify(settings, null, 2);

    const filePath = `${UPLOAD_FOLDER}/${context}${CONTEXT_FILE_EXTENSION}`;

    fs.writeFileSync(filePath, text, 'utf8');

    //Set the proper headers
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${Math.floor( Date.now() / 1000 )}-${context}${CONTEXT_FILE_EXTENSION}`);  

    //Create a read stream and pipe to the response
    fs.createReadStream(filePath).pipe(res);

  } catch(error: any) {
    return res.status(201).json({
      error: error.message
    });
  }
}




const uploadFiles = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    
    const secret = req.headers['x-secret'] as string;
    const contextName = req.headers['x-context-name'] as string;

    if (!validateSecret(contextName, secret)) {
      throw new Error("invalid secret");
    }
    
    const form = new formidable.IncomingForm({ uploadDir: UPLOAD_FOLDER, keepExtensions: true });
  
    // rename uploading QA-Docs files to it's original name (to have a meaningful sourcefile names when displaying references)
    // files with reserved extensions get the namespace
    form.on('fileBegin', (name: string, file: File) => {

      let fileName = file.originalFilename as string;

      for (let ext of RESERVED_FILE_EXTENSIONS) {
        if (file.originalFilename?.endsWith(ext)) {
          fileName = `${contextName}${ext}`;
          break;
        }
      }

      file.filepath = file.filepath.replace(file.newFilename, fileName);
    });
  
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(201).json({
          error: err.message
        });
      } else {
        try {
          // get ctx-files info
          const ctxFileInfos: File[] = Object.keys(files)
          .map(key => files[key] as File)
          .filter(file => RESERVED_FILE_EXTENSIONS.some(ext => file.originalFilename?.endsWith(ext)));

          // try to parse ctx files
          ctxFileInfos.forEach(item => {
            const o = JSON.parse(fs.readFileSync(item.filepath,'utf8'));
            if (!ContextSettings.Validate(o)) {
              throw new Error("invalid json");
            }
          });

          // get doc-files info
          const docFileInfos: File[] = Object.keys(files)
          .map(key => files[key] as File)
          .filter(file => !RESERVED_FILE_EXTENSIONS.some(ext => file.originalFilename?.endsWith(ext)))  // filter docFiles only

          // add docfiles to vector store and then delete them in the file-system 
          const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));        
          const { before, after } = await vectorStore.add(contextName, docFileInfos.map(item => item.filepath));
          docFileInfos.forEach(item => fs.unlinkSync(item.filepath));
    
          return res.status(201).json({
            data: {
              contextName,
              before,
              after,
              files: docFileInfos.map(item => item.originalFilename),
              text: `${docFileInfos.length} files vectorized`
            }
          });

        } catch (error: any) {
          return res.status(201).json({
            error: error.message
          });
        }
      }
    })

  } catch(error: any) {
    return res.status(201).json({
      error: error.message
    });
  }
};

const deleteVectors = async (
  req: NextApiRequest, 
  res: NextApiResponse 
) => {
  try {
    const secret = req.headers['x-secret'] as string;
    const contextName = req.headers['x-context-name'] as string;

    if (!validateSecret(contextName, secret)) {
      throw new Error("bad secret");
    }

    // remove ctx files
    RESERVED_FILE_EXTENSIONS.forEach(ext => {
      const filePath = `${UPLOAD_FOLDER}/${contextName}${ext}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }          
    });

    // clear vector
    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
    const { before, after } = await vectorStore.clear(contextName);
  
    return res.status(201).json({
      data: {
        contextName,
        before,
        after,
        text: `${before - after} vectors cleared`
      }    
    });

  } catch (error: any) {
    return res.status(500).json({
      error: error.message
    });
  }
};

const validateSecret = (namespace: string, secret: string) => {
  const admin_secret = process.env.ADMIN_SECRET;
  return admin_secret && (NEXT_PUBLIC_READONLY_CONTEXTS.every(item => item != namespace) || secret == process.env.ADMIN_SECRET);
}


