export interface OpenAISettings {
  modelName: string,
  modelTokenLimit: number,
  maxTokens: number,
  temperature: number,
  prompts: string[][]
}

export const OpenAISettingsSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "modelName": {
      "type": "string"
    },
    "modelTokenLimit": {
      "type": "integer"
    },
    "maxTokens": {
      "type": "integer"
    },
    "temperature": {
      "type": "number"
    },
    "prompts": {
      "type": "array",
      "items": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
  },
  "required": [
    "prompts"
  ]
}

export const DefaultOpenAISettings = (): OpenAISettings => {
  return {
    modelName: 'gpt-3.5-turbo',
    modelTokenLimit: 4096,
    maxTokens: 250,
    temperature: 0.5,
    prompts: []
  }
}
