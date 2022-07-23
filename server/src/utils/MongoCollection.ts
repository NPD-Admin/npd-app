import { Collection, WithId, Document, MongoClient, ServerApiVersion } from "mongodb";

export { Collection, WithId, Document };
export class MongoCollection {
  private static client: MongoClient;
  private static collections: Map<string, MongoCollection> = new Map<string, MongoCollection>();
  readonly collection: Collection;

  static async getCollection(collectionName: string): Promise<MongoCollection> {
    if (this.collections.has(collectionName)) return this.collections.get(collectionName)!;
    console.log(`Connecting to Mongo Collection NPD-Data/${collectionName}...`);

    if (!this.client) this.client = await MongoClient.connect(process.env.MONGO_URI!, {
      serverApi: ServerApiVersion.v1
    });
    else this.client = await Promise.resolve(this.client);
    await Promise.resolve();

    const newCollection = new MongoCollection(this.client.db('NPD-Data').collection(collectionName));
    this.collections.set(collectionName, newCollection);
    return newCollection;
  }

  constructor(collection: Collection) {
    this.collection = collection;
  }
}