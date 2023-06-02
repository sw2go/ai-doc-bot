import formidable from "formidable";
import IncomingForm from "formidable/Formidable";
import { NextApiRequest } from "next";
import fs from 'fs';
import { PROTECTED_CONTEXTS } from "@/config/runtimeSettings";
import { ContextSettings } from "./contextSettings";
import { CTX_DIR, WORKING_DIR } from "@/config/serverSettings";

export const parseForm = (req: NextApiRequest, form: IncomingForm) => new Promise<{fields: formidable.Fields, files: formidable.Files}>((resolve, reject) => {
  form.parse(req, async (err, fields, files) => {
    if (err) {
      reject(err);
    } else {
      resolve({ fields, files} );
    }
  });
});

export const getDirectoryEntries = (folder: string) => new Promise<fs.Dirent[]>((resolve, reject) => {
  fs.readdir(folder, { withFileTypes: true }, (err, files) => {
    if (err) {
      reject(err);
    } else {
      resolve(files);
    }
  });
});

export const isContextAvailable = (filePath: string, contextName: string) => {
  if (!fs.existsSync(filePath)) {
    if (PROTECTED_CONTEXTS.some(x => x == contextName)) {
      ContextSettings.Add(contextName,'OpenAI-QA');   // if READONLY_CONTEXT Config is missing create it .. 
    } else {
      throw(new Error('Context is missing'));       // 
    }
  }
}


  