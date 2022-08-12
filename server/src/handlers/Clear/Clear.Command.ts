import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from "discord.js";
import { EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";

export class ClearCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'clear',
    description: 'Clears all messages from a channel, or all the bot\'s messages from a DM.',
    options: [{
      name: 'dm',
      description: 'Clear out DMs with this user.',
      type: 5
    }]
  };

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<void> {
    if (!payload.options.getBoolean('dm')) {
      if (payload.user.id !== payload.guild?.ownerId)
        return payload.reply({ ephemeral: true, content: 'This command can only be run in a guild channel by the guild owner.' });
    }

    const channel = (payload.options.getBoolean('dm') && payload.user.dmChannel) || payload.channel;
    await payload.deferReply({ ephemeral: true });

    let messages;
    while ((messages = await channel?.messages.fetch())?.size) {
      if (!messages.some(m => m.deletable)) break;
      await Promise.all(messages.map(m => (m.deletable && m.delete()) || Promise.resolve()));
    }

    await payload.editReply('Channel messages deleted.');
  }
}