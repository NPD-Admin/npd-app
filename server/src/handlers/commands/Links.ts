import { ApplicationCommandDataResolvable, CommandInteraction, EmbedField, EmbedFieldData, Message, MessagePayload, Snowflake } from "discord.js";
import { EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { Asset } from "../../utils/AssetLoader";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { MongoCollection } from "../../utils/MongoCollection";

type EmbedLinksAsset = Asset & {
  guildId: Snowflake;
  msgJson: MessagePayload['data'] & Message
};

type EmbeddedLinkAsset = Asset & {
  guildId: Snowflake;
  fieldJson: EmbedFieldData & EmbedField
};

export class LinksCommand implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ApplicationCommandDataResolvable = {
    name: 'links',
    description: 'Posts guild-configured links to the current channel.'
  };

  listeningFor(evt: CommandInteraction) { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<void> {
    const assetCollection = (await MongoCollection.getCollection('assets')).collection;
    const linksAsset = await assetCollection.findOne({ type: 'EmbedLinksAsset', guildId: payload.guildId }) as EmbedLinksAsset;
    const links = await assetCollection.find({ type: 'EmbeddedLinkAsset', guildId: payload.guildId }).sort('order', 1).toArray() as EmbeddedLinkAsset[];
    linksAsset.msgJson.embeds[0].fields = [ ...links.map(l => l.fieldJson) ];

    await payload.channel?.send(DiscordUtils.createMessagePayload(payload.channel!, linksAsset.msgJson));
    await payload.reply({ ephemeral: true, content: 'Links posted.' });
  }
}