import { Message } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { HandlerConfig } from "../../types/handlers/configs/HandlerConfig";
import { IHandler } from "../../types/handlers/IHandler";
import { Seen } from "./Seen";

export class SeenMessage extends BaseHandler implements IHandler {
  type: EventType = EventType.MESSAGE;
  
  async init(instance: NPDBot): Promise<void> { await Seen.init(instance); }
  listeningFor(payload: Message): boolean { return payload.inGuild(); }
  async callback(payload: Message): Promise<any> { return await Seen.update(payload); }

  config: HandlerConfig = {
    name: 'PresenceMessage',
    description: 'Update presence based on message traffic.'
  };
}