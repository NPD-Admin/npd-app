import { Client, Guild, Interaction, Snowflake, TextChannel } from 'discord.js';

import Setup from './config/Setup';

import { INTENTS as intents, PARTIALS as partials } from './config/ClientConfig';
import { IHandler } from './types/handlers/IHandler';
import { BotEvent } from './types/events/EventType';
import { WithId } from './utils/MongoConnection';
import { ErrorGenerator } from './utils/ErrorGenerator';
import { BaseHandler } from './types/handlers/BaseHandler';

export type BotConfig = {
  type: 'BotConfig';
  guildId: Snowflake;
  logChannelId: Snowflake;
  archivedChannelCategory: Snowflake[];
  twitterFeederChannelId: Snowflake;
  guild: Guild | null;
  logChannel: TextChannel | null;
};

export class NPDBot {
  readonly configs: WithId<BotConfig>[] = [];
  isActive: boolean = false;
  handlers: IHandler[] = [];

  constructor(readonly client: Client = new Client({ intents, partials })) { Setup.runSetup(this, this.client = client); }
  async login(token: string | undefined): Promise<void> { await this.client.login(token); }

  getConfig(guildId: Snowflake): WithId<BotConfig> | undefined { return this.configs.find(config => config.guildId === guildId); }

  async handle(evtPayload: BotEvent): Promise<void> {
    if (!this.isActive) return console.log('Bot Disabled.');
      
    const result = await Promise.all(this.handlers.map(handler =>
      BaseHandler.chooseEventTypeFilter(evtPayload) === handler.type
      && handler.listeningFor(evtPayload)
      && handler.callback(evtPayload))
    ).catch(e => [ErrorGenerator.generate({ e, message: 'Error executing callbacks:' })]);
    
    if (evtPayload instanceof Interaction && evtPayload.isRepliable() && !evtPayload.replied) {
      await this.interactionErrorHandler(evtPayload, result);
    }
  }

  private async interactionErrorHandler(interaction: Interaction, result: void | Error[]): Promise<void> {
    if (interaction.isRepliable() && !interaction.replied) {
      if ((result instanceof Array<Error>) && (result as Array<Error>).length && result.some(c => c)) {
        await interaction.reply({ ephemeral: true, content: `Encountered error(s) processing interaction:\n${result.map(e => e && e.message).join('\n\n')}` })
          .catch(console.error);
      } else {
        await interaction.reply({ ephemeral: true, content: 'This interaction is not being handled at this time.' })
          .catch(console.error);
        console.error('Unhandled Interaction:\n', interaction);
      }
    }
  }
}