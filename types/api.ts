export type Chat = { 
  session: string,
  contextName: string, 
  question: string, 
  history: [string, string][],
  promptId?: number,
  promptTemperature?: number,
  maxTokens?: number,
}

export type ContextInfo = {
  name: string;
  type: number;
};

export type ContextInit = {
  name: string;
  mode: string;
};

export type VectorInfo = {
  change: number;
  vectorCount: number;
}

export type OneTimeKey = {
  key: string;
}