import { AIChatMessage, BaseChatMessage, HumanChatMessage } from "langchain/schema";
import { countTokens } from "./countToken";
import { ServerStorage } from "./serverStorage";

export const GENERATED_QUESTION_RESPONSE_PREFIX = '**Im Kontext des Chat-Verlaufs verstehe ich die Frage so:** ';

export const getPrompt = (startId: number | undefined, prompts: string[][]) => {
  let pid = (startId && startId >= 0) ? (prompts.length > startId) ? startId : prompts.length -1 : 0;
  while(pid > 0 && prompts[pid].length == 0) {
    pid--;
  }
  // console.log('using promptId:', pid);
  return prompts[pid].join('\n');
}

export const getChatHistoryMessages = async (history: [string,string][], remainingTokens: number) => {
    let result: BaseChatMessage[] = [];
    const serverStorage = new ServerStorage(3600);
    let tokensUsed = 0;

    const h = history || [];
    
    for (let i=h.length -1; i >= 0; i--) {

      let question = h[i][0];
      let answer = h[i][1].startsWith(GENERATED_QUESTION_RESPONSE_PREFIX) ? h[i][1].substring(GENERATED_QUESTION_RESPONSE_PREFIX.length) :  h[i][1];

      let questionTokenCount = await serverStorage.GetCreateItem(question, () => countTokens( `Human: ${question}\n`)); // langchain adds 'Human' and 'Assistant' in the Chat-History
      let answerTokenCount = await serverStorage.GetCreateItem(answer, () => countTokens(`Assistant: ${answer}\n`));    // -> we have to count them too

      tokensUsed += (questionTokenCount + answerTokenCount);

      //console.log(`used: ${tokensUsed} rem: ${remainingTokens} h[q]: ${questionTokenCount} h[a]: ${answerTokenCount}  -  ${question} - ${answer.substring(0, 15)}`);

      if (tokensUsed > remainingTokens) {
        console.log(`chat history cutoff after ${i} messages of ${h.length} due to token limit.`);
        break;  // -> quit loop (this skip's older conversation messages) we have too few tokens left  
      } else {      
        result.unshift(new AIChatMessage(answer));
        result.unshift(new HumanChatMessage(question));
      } 
    }

    //console.log("-hist", history.length);
    //history.forEach(x => { console.log(x[0]); console.log(x[1].substring(0,15));} );
    //console.log("-result", result.length);
    //result.forEach(x => console.log(x.text.substring(0,15)));    

    return result;
  }

  export enum TokenSource {
    Default = 0,
    QuestionGenerator = 1,
    Error = 2,
    Timeout = 3
  }