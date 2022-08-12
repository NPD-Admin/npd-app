import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";
import { Seen } from "./Seen";

export class SeenCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'seen',
    description: 'When were role members/a user last online.',
    options: [{
      name: 'user',
      description: 'The user or role to check.',
      type: 9,
      required: true
    }]
  }

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name; }

  async init(instance: NPDBot): Promise<void> {
    await Seen.init(instance);
  }

  async callback(payload: CommandInteraction): Promise<any> {
    return await Seen.getSeenData(payload);
  }
}