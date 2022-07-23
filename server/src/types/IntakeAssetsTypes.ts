import { ObjectId } from "mongodb";

interface IntakeAssetData {
  assetId: ObjectId;
  fieldMapping: string;
  order: number;
}

interface IntakeAsset {
  _id: ObjectId;
  fieldMapping: string;
  order: number;
  text?: string;
  json?: string;
}

export { IntakeAssetData, IntakeAsset };