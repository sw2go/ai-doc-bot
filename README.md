# ai-doc-bot 
Chat with your documents. A chatbot app using OpenAI. 
- Define context names, e.g. topics you want to ask questions about, like 'a service' or 'a product'.
- Prepare some documents with relevant content for the specific topics. 
- Preparing may be crucial, depending on text-chunk-size, local/global text context and occurance of keywords in the texts the chat-experience will differ.    
- Then upload your documents (*.txt and/or *.pdf files) to the corresponding context. 
- Optionally customize the prompt used in a context, by uploading the modified settings.  

## Development

1. Clone the repo

```
git clone git@github.com:sw2go/ai-doc-bot.git
```

2. Install packages

```
npm install
```

3. Set up your `.env` file

- Copy `.env.example` into `.env` and set variables according to your needs.
- Visit [openai](https://help.openai.com/en/articles/4936850-where-do-i-find-my-secret-api-key) to retrieve API keys and insert into your `.env` file.
- Visit [pinecone](https://pinecone.io/) create a index with 1536 dimensions and retrieve your API keys, your environment and index name from the dashboard to insert into your `.env` file.

## Run the app

- `npm run dev` to launch the local dev environment

## Credit

This repo is inspired and based on a sample from mayooear: [gpt4-pdf-chatbot-langchain](https://github.com/mayooear/gpt4-pdf-chatbot-langchain).

How to dockerize a next.js web-app you can learn here: https://geshan.com.np/blog/2023/01/nextjs-docker/

