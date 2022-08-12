import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction, MessagePayload, Snowflake } from "discord.js";
import { EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";
import { MongoConnection } from "../../utils/MongoConnection";
import { Asset } from '../../utils/AssetLoader';
import { DiscordUtils } from "../../utils/DiscordUtils";

type DonateAsset = Asset & {
  guildId: Snowflake;
  msgJson: MessagePayload['data']
};

export class DonateCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'donate',
    description: 'Posts an embed requesting donations to the current guild channel.'
  };

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<any> {
    const donateAsset = await MongoConnection.getCollection('assets').findOne({ type: 'DonationEmbedAsset', guildId: payload.guildId }) as DonateAsset;
    payload.channel?.send(DiscordUtils.createMessagePayload(payload.channel!, donateAsset.msgJson));
    await payload.reply({ ephemeral: true, content: 'Donation embed posted.' });
  }
}