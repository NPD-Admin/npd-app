import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { Reaction } from "../../types/events/Reaction";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { HandlerConfig } from "../../types/handlers/configs/HandlerConfig";
import { IHandler } from "../../types/handlers/IHandler";
import { Seen } from "./Seen";

export class SeenReaction extends BaseHandler implements IHandler {
  type: EventType = EventType.REACTION;

  async init(instance: NPDBot): Promise<void> { await Seen.init(instance); }
  listeningFor(payload: Reaction): boolean { return payload.r.message.inGuild(); }
  async callback(payload: Reaction): Promise<any> { await Seen.update(payload); }

  config: HandlerConfig = {
    name: 'PresenceReaction',
    description: 'Update presence based on reactions.'
  };
}