import { Message } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { SeenTracker } from "../shared/SeenTracker";

export class PresenceMessage implements IHandler {
  type: EventType = EventType.MESSAGE;
  
  async init(instance: NPDBot): Promise<void> { await SeenTracker.init(instance); }
  listeningFor(payload: Message): boolean { return payload.inGuild(); }
  async callback(payload: Message): Promise<any> { return await SeenTracker.update(payload); }

  config: any = {
    name: 'PresenceMessage',
    description: 'Update presence based on message traffic.'
  };
}