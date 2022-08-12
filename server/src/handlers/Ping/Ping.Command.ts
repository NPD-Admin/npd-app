import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

import { EventType } from '../../types/EventTypes';
import { BaseHandler, IHandler } from '../../types/IHandler';

export class Ping extends BaseHandler implements IHandler {
  config: ChatInputApplicationCommandData = {
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