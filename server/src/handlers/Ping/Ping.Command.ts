import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

import { EventType } from '../../types/events/EventType';
import { BaseHandler } from '../../types/handlers/BaseHandler';
import { IHandler } from '../../types/handlers/IHandler';

export class PingCommand extends BaseHandler implements IHandler {
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