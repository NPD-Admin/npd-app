import { ApplicationCommandDataResolvable, CommandInteraction } from "discord.js";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";

export default class Sock implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ApplicationCommandDataResolvable = {
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