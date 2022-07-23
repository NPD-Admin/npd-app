import { ApplicationCommandDataResolvable, CommandInteraction, MessageActionRow, Modal, TextInputComponent } from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';

import { EventType } from "../../types/EventTypes";
import { IHandler } from '../../types/IHandler';
import { admin_directory_v1, Common, GoogleClient } from '../../utils/Google/GoogleClient';

export class Debug implements IHandler {
  config: ApplicationCommandDataResolvable = {
    name: 'debug',
    description: 'Test new functionality.',
    options: [{
      name: 'email',
      description: 'email to add',
      type: 3,
      required: true
    }]
  }

  type: EventType = EventType.COMMAND

  listeningFor(command: CommandInteraction): boolean { return (command.commandName === 'debug'); }

  async callback(command: CommandInteraction): Promise<void> {
    command.reply({ ephemeral: true, content: 'No /debug handler.' });
  }
}