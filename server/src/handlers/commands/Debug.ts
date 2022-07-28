import { ApplicationCommandDataResolvable, CommandInteraction, MessageActionRow, Modal, TextInputComponent } from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';

import { EventType } from "../../types/EventTypes";
import { IHandler } from '../../types/IHandler';
import { admin_directory_v1, Common, GoogleClient } from '../../utils/Google/GoogleClient';
import { MailerLite } from '../../utils/MailerLite';

export class Debug implements IHandler {
  config: ApplicationCommandDataResolvable = {
    name: 'debug',
    description: 'Test new functionality.',
    options: [{
      name: 'email',
      description: 'email to add',
      type: 3
    }]
  }

  type: EventType = EventType.COMMAND

  listeningFor(command: CommandInteraction): boolean { return (command.commandName === 'debug'); }

  async callback(command: CommandInteraction): Promise<void> {
    const email = command.options.getString('email');
    if (!email) return command.reply({ ephemeral: true, content: 'Please provide an email address.' });

    const r = await MailerLite.addGroupMember('61274307477636533', email);
    if (r instanceof Error) return command.reply({ ephemeral: true, content: r.message });
    command.reply({ ephemeral: true, content: `Subscriber ID: ${r.id}` });
  }
}