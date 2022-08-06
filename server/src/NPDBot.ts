import { Client, CommandInteraction, Guild, GuildMember, Interaction, Message, Snowflake, TextChannel } from 'discord.js';

import Setup from './config/Setup';

import { INTENTS as intents, PARTIALS as partials } from './config/ClientConfig';
import { IHandler } from './types/IHandler';
import { BotEvent, EventType, PresenceChange, Reaction } from './types/EventTypes';
import { WithId } from './utils/MongoCollection';

export type BotConfig = {
  type: 'BotConfig',
  guildId: Snowflake,
  logChannelId: Snowflake,
  guild: Guild | null,
  logChannel: TextChannel | null,
  archivedChannelCategory: Snowflake[]
};

export class NPDBot {
  readonly configs: WithId<BotConfig>[] = [];
  isActive: boolean = false;
  handlers: IHandler[] = [];

  constructor(readonly client: Client = new Client({ intents, partials })) { Setup.runSetup(this, this.client = client); }
  async login(token: string | undefined): Promise<void> { await this.client.login(token); }

  getConfig(guildId: Snowflake): WithId<BotConfig> | undefined { return this.configs.find(config => config.guildId === guildId); }

  private async handle(evtPayload: BotEvent, type: EventType): Promise<void | Error[]> {
    if (!this.isActive) return console.log('Bot disabled.');
    const handlers = this.handlers.filter(handler => handler.type === type && handler.listeningFor(evtPayload));
    return await Promise.all(handlers.map(handler => handler.callback(evtPayload))).catch(console.error);
  }

  async handleReaction(reaction: Reaction): Promise<void> { this.handle(reaction, EventType.REACTION); }
  async handlePresence(change: PresenceChange): Promise<void> { this.handle(change, EventType.PRESENCE); }
  async handleMessages(message: Message): Promise<void> { this.handle(message, EventType.MESSAGE); }
  async handleMember(member: GuildMember): Promise<void> { this.handle(member, EventType.MEMBER); }
  async handleInteractions(interaction: Interaction): Promise<void> {
    const type: EventType = (interaction.isCommand() && EventType.COMMAND) || EventType.INTERACTION;
    const result = await this.handle(interaction, type);

    if (this.isActive) await this.defaultInteractionHandler(interaction, result);
  }

  private async defaultInteractionHandler(interaction: Interaction, result: void | Error[]): Promise<void> {
    if (interaction.isRepliable() && !interaction.replied) {
      if ((result instanceof Array<Error>) && (result as Array<Error>).length && result.some(c => c)) {
        await interaction.reply({ ephemeral: true, content: `Encountered error(s) processing interaction:\n${result.map(e => e && e.message).join('\n\n')}` });
      } else if (!(interaction instanceof CommandInteraction)) {
        await interaction.reply({ ephemeral: true, content: 'This interaction is not being handled at this time.' });
        console.error('Unhandled Interaction:\n', interaction);
      }
    }
  }
}