const PROTECTED_CONTEXTS =  process.env.PROTECTED_CONTEXTS ? process.env.PROTECTED_CONTEXTS.split(';') : [ 'MyTopic'];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(';') : [ 'https://www.google.com', 'https://www.sbb.ch'];

export { PROTECTED_CONTEXTS, ALLOWED_ORIGINS }