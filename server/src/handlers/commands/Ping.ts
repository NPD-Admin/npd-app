import { ApplicationCommandDataResolvable, CommandInteraction } from 'discord.js';

import { EventType } from '../../types/EventTypes';
import { IHandler } from '../../types/IHandler';

export class Ping implements IHandler {
  config: ApplicationCommandDataResolvable = {
    name: 'ping',
    description: 'pong'
  };

  type: EventType = EventType.COMMAND;

  listeningFor({ commandName }: CommandInteraction): boolean {
    return ((commandName) === 'ping');
  }

  callback(command: CommandInteraction): Promise<void> {
    return command.reply({
      content: 'pong',
      ephemeral: true
    });
  }
}