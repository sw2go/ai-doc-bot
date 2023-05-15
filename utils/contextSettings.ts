import { CONTEXT_FILE_EXTENSION, UPLOAD_FOLDER } from "@/config/serverSettings";
import { Validator } from "jsonschema";
import fs from 'fs';

export class ContextSettings {
  public static Create(namespace: string): BaseContextSettings {
    const filePath = `${UPLOAD_FOLDER}/${namespace}${CONTEXT_FILE_EXTENSION}`;
    
    try {
      const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(settings);
      return settings;
    } catch (error) {
      console.log(error);
      console.log(`${filePath} file not found`);
    }

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