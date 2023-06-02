import { PROTECTED_CONTEXTS } from "@/config/runtimeSettings";
import { NextApiRequest } from "next";

export const validateSecret = (req: NextApiRequest, contextName: string) => {
  const secret = req.headers['x-secret'] as string;
  const admin_secret = process.env.ADMIN_SECRET;
  if (contextName.length == 0) {  // unconditional check
    if (admin_secret && secret == process.env.ADMIN_SECRET) {
      return; // OK
    }
  } else if(admin_secret && (PROTECTED_CONTEXTS.every(item => item != contextName) || secret == process.env.ADMIN_SECRET)) {
    return; // OK    
  }
  throw (new Error('Invalid secret'));
};