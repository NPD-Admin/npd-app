import { OutgoingHttpHeaders } from "http";
import { HTTPSRequest } from "./HTTPSRequest";
import { MongoCollection } from "./MongoCollection";

export class MailerLite {
  private static assetCollection: MongoCollection;

  private static async getAssetCollection(): Promise<MongoCollection> {
    if (this.assetCollection) return this.assetCollection;
    this.assetCollection = await MongoCollection.getCollection('assets');
    return this.assetCollection;
  }

  static async addGroupMember(groupId: string, email: string): Promise<{ id: string } | Error> {
    const url = `https://api.mailerlite.com/api/v2/groups/${groupId}/subscribers`;
    const headers: OutgoingHttpHeaders = {
      'X-MailerLite-ApiKey': process.env.mailerlite,
      'Content-type': 'application/json'
    };
    const payload = {
      email,
      resubscribe: true,
      type: 'active',
      autoresponders: true
    };
    const addRes = await HTTPSRequest.httpsPayloadRequest('POST', url, payload, headers).catch(console.error);
    if (addRes) return JSON.parse(addRes.toString()) as { id: string };
    return new Error('Error adding subscriber to group.');
  }
}