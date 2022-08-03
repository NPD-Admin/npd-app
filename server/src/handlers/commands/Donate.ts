import { ApplicationCommandDataResolvable, CommandInteraction, MessagePayload, Snowflake } from "discord.js";
import { EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { MongoCollection } from "../../utils/MongoCollection";
import { Asset } from '../../utils/AssetLoader';
import { DiscordUtils } from "../../utils/DiscordUtils";

type DonateAsset = Asset & {
  guildId: Snowflake;
  msgJson: MessagePayload['data']
};

export class DonateCommand implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ApplicationCommandDataResolvable = {
    name: 'donate',
    description: 'Posts an embed requesting donations to the current guild channel.'
  };

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<any> {
    const donateAsset = await (await MongoCollection.getCollection('assets')).collection.findOne({ type: 'DonationEmbedAsset', guildId: payload.guildId }) as DonateAsset;
    payload.channel?.send(DiscordUtils.createMessagePayload(payload.channel!, donateAsset.msgJson));
    await payload.reply({ ephemeral: true, content: 'Donation embed posted.' });
  }
}