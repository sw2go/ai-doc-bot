const READONLY_CONTEXTS =  process.env.READONLY_CONTEXTS ? process.env.READONLY_CONTEXTS.split(';') : [ 'MyTopic'];
const EDITABLE_CONTEXTS =  process.env.EDITABLE_CONTEXTS ? process.env.EDITABLE_CONTEXTS.split(';') : [ 'Test']

export { READONLY_CONTEXTS, EDITABLE_CONTEXTS }