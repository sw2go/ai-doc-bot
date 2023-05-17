import {  NEXT_PUBLIC_PROVIDER_NAME, NEXT_PUBLIC_PROVIDER_URL } from "@/config/buildtimeSettings";
import { EDITABLE_CONTEXTS, READONLY_CONTEXTS } from "@/config/runtimeSettings";
import { UiContext } from "@/types/uiContext";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse,  
  ) {

  switch(req.method?.toLowerCase()) {
    case 'get':
      return await getUiContext(req, res);
      
    default:
      return res.status(404).json({ error: "invalid method"});
  }
};

const getUiContext = async (
  req: NextApiRequest, 
  res: NextApiResponse,
) => {
  return res.status(200).send({
    readonly: READONLY_CONTEXTS,
    editable: EDITABLE_CONTEXTS,
    providerName: NEXT_PUBLIC_PROVIDER_NAME(),
    providerUrl: NEXT_PUBLIC_PROVIDER_URL()
  });
}

