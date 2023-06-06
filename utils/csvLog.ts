import { WORKING_DIR } from "@/config/serverSettings";
import { createObjectCsvWriter } from "csv-writer";
import { BaseContextSettings } from "./contextSettings";
import fs from 'fs';

export class CsvLog {
  constructor() {    
  }

  public static filePath: string = `${WORKING_DIR}/log/chatbot.csv`;
  public static downloadPath = (key: string) => `${WORKING_DIR}/log/${key}-download.csv`

  public static create(append: boolean) {
    return createObjectCsvWriter({
      path: CsvLog.filePath,
      header: [
        {id: 'timestamp',   title: 'TIME' },
        {id: 'userAgent',   title: 'AGENT' },
        {id: 'session',     title: 'SESSION' },
        {id: 'contextName', title: 'CONTEXT' },        
        {id: 'maxTokens',   title: 'MAXTOK' },        
        {id: 'promptTemp',  title: 'TEMP' },
        {id: 'history',     title: 'HIST' },
        {id: 'promptId',    title: 'PROMPT' },
        {id: 'question',    title: 'QUESTION' },
        {id: 'response',    title: 'RESPONSE' },
        {id: 'settings',    title: 'SETTINGS' },
      ],
      fieldDelimiter: ';',
      append: append
    });
  }

  public static async append(    
    userAgent: string,
    session: string,    
    contextName: string, 
    maxTokens: number,
    promptTemp: number,
    history: number, 
    promptId: number,  
    question: string,
    response: string,
    settings: BaseContextSettings
    ) {
      const writer = CsvLog.create(fs.existsSync(CsvLog.filePath));
      await writer.writeRecords([
        {
          timestamp: (new Date()).toISOString(),
          userAgent,
          session,
          contextName,
          maxTokens,
          promptTemp,
          history,
          promptId,
          question,
          response,
          settings: JSON.stringify(settings, null, 2)
        }
      ]);
    }
}