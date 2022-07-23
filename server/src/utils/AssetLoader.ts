import { join } from 'path';

import { Document, WithId } from 'mongodb';

import { MongoCollection } from './MongoCollection';

type Asset = WithId<Document> & { identifier: string };
type AssetFile = { collection: string, data: Asset[] };

export class AssetLoader {
  static async loadAssets(filename: string): Promise<[string, string[]] | Error> {
    const path = (filename.startsWith(process.cwd()) && filename) ||
      join(process.cwd(), 'assets', filename);
    
    const fileData = require(path) as AssetFile;
    if (typeof fileData.collection !== 'string' || !(fileData.data instanceof Array<Asset>))
      return new Error(`Invalid asset: ${path}`);

    const assetIdentifiers = fileData.data.map(d => d.identifier);
    const collection = (await MongoCollection.getCollection(fileData.collection));
    await collection.collection.deleteMany({ identifier: { $in: assetIdentifiers } });
    await collection.collection.insertMany(fileData.data);
    
    return [fileData.collection, assetIdentifiers];
  }

  static async deleteStaleAssets({ collectionName, freshAssetIdentifiers }: { collectionName: string, freshAssetIdentifiers: string[] }): Promise<{ [k: string]: Number }> {
    const collection = await MongoCollection.getCollection(collectionName);
    const result = await collection.collection.deleteMany({ identifier: { $not: { $in: freshAssetIdentifiers } } });
    return { [collectionName]: result.deletedCount };
  }
}