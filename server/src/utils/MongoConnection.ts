import { Collection, WithId, Document, MongoClient, ServerApiVersion } from "mongodb";
import { ErrorGenerator } from "./ErrorGenerator";

export { Collection, WithId, Document };
export class MongoConnection {
  private static client: MongoClient;
  private static collections: Map<string, Collection> = new Map<string, Collection>();

  static async init(): Promise<MongoClient> {
    if (this.client) return Promise.resolve(this.client);

    if (!process.env.MONGO_URI) return Promise.reject(ErrorGenerator.generate({ message: 'No MongoDB URI is configured.' }));

    return this.client = await MongoClient.connect(process.env.MONGO_URI, {
      serverApi: ServerApiVersion.v1
    });
  }

  static getCollection(collectionName: string): Collection {
    if (this.collections.has(collectionName)) return this.collections.get(collectionName)!;
    console.log(`Connecting to Mongo Collection NPD-Data/${collectionName}...`);

    const collection = this.client.db('NPD-Data').collection(collectionName);
    return this.collections.set(collectionName, collection).get(collectionName)!;
  }
}