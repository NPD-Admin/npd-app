import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction, EmbedField, EmbedFieldData, Message, MessagePayload, Snowflake } from "discord.js";
import { EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";
import { Asset } from "../../utils/AssetLoader";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { MongoConnection } from "../../utils/MongoConnection";

type EmbedLinksAsset = Asset & {
  guildId: Snowflake;
  msgJson: MessagePayload['data'] & Message
};

type EmbeddedLinkAsset = Asset & {
  guildId: Snowflake;
  fieldJson: EmbedFieldData & EmbedField
};

export class LinksCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'links',
    description: 'Posts guild-configured links to the current channel.'
  };

  listeningFor(evt: CommandInteraction) { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<void> {
    const assetCollection = MongoConnection.getCollection('assets');
    const linksAsset = await assetCollection.findOne({ type: 'EmbedLinksAsset', guildId: payload.guildId }) as EmbedLinksAsset;
    const links = await assetCollection.find({ type: 'EmbeddedLinkAsset', guildId: payload.guildId }).sort('order', 1).toArray() as EmbeddedLinkAsset[];
    linksAsset.msgJson.embeds[0].fields = [ ...links.map(l => l.fieldJson) ];

    await payload.channel?.send(DiscordUtils.createMessagePayload(payload.channel!, linksAsset.msgJson));
    await payload.reply({ ephemeral: true, content: 'Links posted.' });
  }
}