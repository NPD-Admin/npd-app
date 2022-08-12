import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from "discord.js";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";

export class Sock extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'sock',
    description: 'Make the bot say something in the current channel.',
    options: [{
      name: 'content',
      description: 'The content to send.',
      type: 3,
      required: true
    }]
  };

  listeningFor({ commandName }: CommandInteraction): boolean {
    return commandName === this.config.name;
  }

  async callback(payload: CommandInteraction): Promise<any> {
    await payload.channel!.send(payload.options.getString('content', true));
    await payload.reply({ ephemeral: true, content: 'I have spoken.' });
  }
}