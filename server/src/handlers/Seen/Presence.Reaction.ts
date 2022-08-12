import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType, Reaction } from "../../types/EventTypes";
import { BaseHandler, HandlerConfig, IHandler } from "../../types/IHandler";
import { SeenTracker } from "./SeenTracker";

export class PresenceReaction extends BaseHandler implements IHandler {
  type: EventType = EventType.REACTION;

  async init(instance: NPDBot): Promise<void> { await SeenTracker.init(instance); }
  listeningFor(payload: Reaction): boolean { return payload.r.message.inGuild(); }
  async callback(payload: Reaction): Promise<any> { await SeenTracker.update(payload); }

  config: HandlerConfig = {
    name: 'PresenceReaction',
    description: 'Update presence based on reactions.'
  };
}