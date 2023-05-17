import { CONTEXT_FILE_EXTENSION, UPLOAD_FOLDER } from "@/config/serverSettings";
import { Validator, ValidatorResult } from "jsonschema";
import fs from 'fs';

export class ContextSettings {
  public static Create(namespace: string): BaseContextSettings {
    const filePath = `${UPLOAD_FOLDER}/${namespace}${CONTEXT_FILE_EXTENSION}`;
    
    try {
      const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const v = new Validator();
      let valid: ValidatorResult | null = v.validate(settings, BaseSchema);

      if (valid.valid) {
        const type = (settings as BaseContextSettings).type;
        switch (type) {
          case 'OpenAI-QA':
            valid = v.validate(settings, QASchema);
            break;
          default:            
            valid = null;    
        }
        if(valid == null) {
          console.log(`${filePath} invalid type value: ${type}`);
        } else if (!valid.valid) {
          console.log(`${filePath} invalid json schema for type: ${type}`);
        } else {
          return settings;
        }
      } else {
        console.log(`${filePath} invalid json schema (missing type field)`);
      }
    } catch (error) {
      console.log(`${filePath} file not found`);
    }
    console.log(`take default QA`);
    return DefaultQAContext(namespace);
  }

  public static Validate(settings: any): boolean {
    const v = new Validator();
    const valid = v.validate(settings, QASchema);
    return valid.valid;
  }
}




export interface BaseContextSettings {
  type: 'OpenAI-QA' | 'Other' | undefined;
  contextName: string;
  modelName: string;
  maxTokens: number;
  promptTemperature: number;
  prompt: string[];
}


export interface QAContextSettings extends BaseContextSettings {
  prepromptTemperature: number;
  preprompt: string[];
  numberSource: number;
  returnSource: boolean;
}

export const DefaultQAContext = (namespace: string): QAContextSettings => {
  return {
    type: 'OpenAI-QA',
    contextName: namespace,
    modelName: 'gpt-3.5-turbo',
    maxTokens: 250,
    promptTemperature: 0.5,
    prompt: [
      `Du bist ein KI-Assistent. Du hilfst beim Erstellen von Marketing Texten für Kunden und Interessenten von ${namespace}.`,  
      `Im Kontext bekommst du einzelne Texte aus einem längeren Dokument das von ${namespace} geschrieben ist.`,
      `Beantworte die Frage konversationsbasiert und verwende dazu den bereitgestellten Kontext und andere Quellen zu den Themen IT und Individualsoftwareentwicklung.`,
      `Bitte erfinde keine Hyperlinks.`,
      ``,
      `Frage: {question}`,
      `=========`,
      `{context}`,
      `=========`,
      `Antworte in Markdown:`
    ],

    prepromptTemperature: 0.5,
    preprompt: [
      `Gegeben ist die folgende Unterhaltung und eine Folgefrage. Formuliere die Folgefrage um, so dass sie eine eigenständige Frage wird.`,
      ``,
      `Chat-Verlauf:`,
      `{chat_history}`,
      `Folgefrage: {question}`,
      `Eigenständige Frage:`
    ],

    numberSource: 2,
    returnSource: true
  }  
}

const BaseSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string"
    },
  },
  "required": [
    "type"
  ]
}

const QASchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string"
    },
    "contextName": {
      "type": "string"
    },
    "modelName": {
      "type": "string"
    },
    "maxTokens": {
      "type": "integer"
    },
    "promptTemperature": {
      "type": "number"
    },
    "prompt": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "prepromptTemperature": {
      "type": "number"
    },
    "preprompt": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "numberSource": {
      "type": "integer"
    },
    "returnSource": {
      "type": "boolean"
    }
  },
  "required": [
    "type",
    "contextName",
    "modelName",
    "maxTokens",
    "promptTemperature",
    "prompt",
    "prepromptTemperature",
    "preprompt",
    "numberSource",
    "returnSource"
  ]
}