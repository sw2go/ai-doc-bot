import { BaseRetriever } from "langchain/schema";
import { VectorStore } from "langchain/vectorstores";

export class CustomRetriever implements BaseRetriever {
  constructor(private vectorStore: VectorStore, private k: number | undefined) {
    //super();
  }

  public  async getRelevantDocuments(query: string)  {
    const records = await this.vectorStore.similaritySearchWithScore(query, this.k);
    return records.map(record => {
      record[0].metadata.score = record[1];
      record[0].pageContent = "..." + record[0].pageContent + "...";
      return record[0];
    });  
  }
}