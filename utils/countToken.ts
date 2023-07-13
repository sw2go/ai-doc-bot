import * as tiktoken from 'js-tiktoken';

export const countTokens = (
    text: string
  ) => {
    const encoding = tiktoken.getEncoding('cl100k_base');   // cl100k_base tokenization scheme for gpt-4 and gpt-3.5-turbo
    const tokens = encoding.encode(text, 'all');
    return tokens.length;
  }