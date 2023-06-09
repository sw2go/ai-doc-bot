import { ADMIN_SECRET } from "@/config/serverSettings";
import { OneTimeKey } from "@/types/api";
import { CsvLog } from "@/utils/csvLog";
import { validateSecret } from "@/utils/validateSecret";
import { on } from "events";
import fs from "fs";
import { NextApiRequest, NextApiResponse } from "next";

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
      return await getLogFile(req, res);
    case 'post':      
      return await createOneTimeKey(req, res);
    case 'delete':
      return await deleteLog(req, res);

    default:
      return res.status(404).json({ error: "Invalid method"});
  }
};


const getLogFile = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {

    const key = req.query?.key as string;

    if (!fs.existsSync(CsvLog.downloadPath(key))) {
      throw new Error('invalid key');
    }

    //Set the proper headers, create a read stream and pipe to the response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=chatbot.csv`);  
    fs.createReadStream(CsvLog.downloadPath(key)).pipe(res).on("close", () => {
      fs.unlinkSync(CsvLog.downloadPath(key));    
    });
  } catch (error: any) {
    res.status(404).send({
      error: error.message
    })
  }
}

const createOneTimeKey = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {

    validateSecret(req,'');

    if (!fs.existsSync(CsvLog.filePath)) {
      throw new Error('no log');
    }
    
    const oneTimeKey = (Date.now() % 179424673).toString(); // big prime

    fs.renameSync(CsvLog.filePath, CsvLog.downloadPath(oneTimeKey));

    const otk: OneTimeKey = {
      key: oneTimeKey
    }

    res.status(200).send(otk);
    
  } catch (error: any) {
    res.status(404).send({
      error: error.message
    })
  }
}
















const deleteLog = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  try {
    validateSecret(req, '');  // unconditional secret check

    if (fs.existsSync(CsvLog.filePath)) {
      // Delete file
      fs.unlinkSync(CsvLog.filePath);
    }

  } catch (error) {

  }

}

