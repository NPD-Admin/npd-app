import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType, PresenceChange } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { SeenTracker } from "../shared/SeenTracker";

export class PresenceUpdater implements IHandler {
  type: EventType = EventType.PRESENCE;

  async init(instance: NPDBot): Promise<void> { SeenTracker.init(instance); }
  listeningFor(change: BotEvent): boolean { return change instanceof PresenceChange; }
  async callback(change: PresenceChange): Promise<any> { await SeenTracker.update(change); }

  config: any = {
    name: 'PresenceUpdater',
    description: 'Updates last seen info based on presence.'
  };

}