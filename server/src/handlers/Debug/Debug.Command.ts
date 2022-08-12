import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

import { EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from '../../types/IHandler';

export class Debug extends BaseHandler implements IHandler {
  config: ChatInputApplicationCommandData = {
    name: 'debug',
    description: 'Test new functionality.'
  }

  type: EventType = EventType.COMMAND

  listeningFor(command: CommandInteraction): boolean { return (command.commandName === 'debug'); }

  async callback(command: CommandInteraction): Promise<void> {
    await command.reply('Debug not configured.');
  }
}