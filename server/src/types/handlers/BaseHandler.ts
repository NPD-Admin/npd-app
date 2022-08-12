import { CommandInteraction, MessageContextMenuInteraction, UserContextMenuInteraction, Interaction, GuildMember, Message, ApplicationCommandData } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../events/EventType";
import { PresenceUpdate } from "../events/PresenceUpdate";
import { Reaction } from "../events/Reaction";
import { TimerEvent } from "../events/TimerEvent";
import { HandlerConfig } from "./configs/HandlerConfig";
import { TimerConfig } from "./configs/TimerConfig";

export abstract class BaseHandler {
  static chooseEventTypeFilter(payload: BotEvent): EventType {
    if (payload instanceof CommandInteraction) return EventType.COMMAND;
    if (payload instanceof MessageContextMenuInteraction) return EventType.COMMAND;
    if (payload instanceof UserContextMenuInteraction) return EventType.COMMAND;
    if (payload instanceof Interaction) return EventType.INTERACTION;
    if (payload instanceof GuildMember) return EventType.MEMBER;
    if (payload instanceof Message) return EventType.MESSAGE;
    if (payload instanceof PresenceUpdate) return EventType.PRESENCE;
    if (payload instanceof Reaction) return EventType.REACTION;
    if (payload instanceof TimerEvent) return EventType.TIMER;
    return EventType.MISC;
  }

  constructor(protected botInstance: NPDBot) {}

  config: ApplicationCommandData | HandlerConfig | TimerConfig = {
    name: 'base',
    description: 'Abstract BaseHandler extended to all handlers.'
  };
  
  listeningFor(payload: BotEvent): boolean { return true; }
}