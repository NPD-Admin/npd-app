import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

import { EventType } from "../../types/events/EventType";
import { BaseHandler } from '../../types/handlers/BaseHandler';
import { IHandler } from '../../types/handlers/IHandler';

export class DebugCommand extends BaseHandler implements IHandler {
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