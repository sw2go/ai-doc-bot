import { LLMResult } from 'langchain/schema';
import { Serialized } from "langchain/load/serializable";
import { BaseCallbackHandler } from 'langchain/callbacks';

export class TimeoutCallbackHandler extends BaseCallbackHandler {
  
    name = "timeout_handler";
    private timeout: NodeJS.Timeout | null = null;
  
    constructor(timeoutSeconds: number, onTimeout: () => void) {
      super();
  
      this.timeout = setTimeout(() => {
        if (this.timeout) {
          this.timeout = null;
          onTimeout();
        }
      }, timeoutSeconds * 1000);
    }
  
    handleLLMStart(llm: Serialized, prompts: string[]) {
      this.timeout?.refresh();    
    }

    handleLLMNewToken(token: string) {
      this.timeout?.refresh();
    }

    handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string) {
      this.timeout = null;
    }

    handleLLMError(err: Error, runId: string, parentRunId?: string) {
      this.timeout = null;
    }
  
  }