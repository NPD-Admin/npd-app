import { ApplicationCommandDataResolvable, CommandInteraction } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { SeenTracker } from "../shared/SeenTracker";

export class SeenCommand implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ApplicationCommandDataResolvable = {
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
    await SeenTracker.init(instance);
  }

  async callback(payload: CommandInteraction): Promise<any> {
    return await SeenTracker.getSeenData(payload);
  }
}