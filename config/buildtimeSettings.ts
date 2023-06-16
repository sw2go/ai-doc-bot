const NEXT_PUBLIC_PROVIDER_NAME = () => process.env.NEXT_PUBLIC_PROVIDER_NAME ?? 'sw2go';
const NEXT_PUBLIC_PROVIDER_URL = () => process.env.NEXT_PUBLIC_PROVIDER_URL ?? 'https://github.com/sw2go/ai-doc-bot';

const API_URL = process.env.NODE_ENV == 'production' ?  '/api' : process.env.NEXT_PUBLIC_TEST_API_URL ?? '/api'; 

export { NEXT_PUBLIC_PROVIDER_NAME, NEXT_PUBLIC_PROVIDER_URL, API_URL };
