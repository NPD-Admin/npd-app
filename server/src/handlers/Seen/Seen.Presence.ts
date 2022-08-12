import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/events/EventType";
import { PresenceUpdate } from "../../types/events/PresenceUpdate";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { HandlerConfig } from "../../types/handlers/configs/HandlerConfig";
import { IHandler } from "../../types/handlers/IHandler";
import { Seen } from "./Seen";

export class SeenPresence extends BaseHandler implements IHandler {
  type: EventType = EventType.PRESENCE;

  async init(instance: NPDBot): Promise<void> { Seen.init(instance); }
  listeningFor(change: BotEvent): boolean { return change instanceof PresenceUpdate; }
  async callback(change: PresenceUpdate): Promise<any> { await Seen.update(change); }

  config: HandlerConfig = {
    name: 'PresenceUpdater',
    description: 'Updates last seen info based on presence.'
  };

}