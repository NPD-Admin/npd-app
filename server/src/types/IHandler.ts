import { ApplicationCommandData, ApplicationCommandDataResolvable, CommandInteraction, GuildMember, Interaction, Message, MessageContextMenuInteraction } from "discord.js";
import { NPDBot } from "../NPDBot";
import { BotEvent, EventType, PresenceChange, Reaction } from "./EventTypes";
import { TimerEvent } from "./TimerEvent";

export interface HandlerConfig {
  name: string;
  description: string;
};

export interface TimerConfig extends HandlerConfig {
  frequency: number;
  time?: string;
};

export interface IHandler extends BaseHandler {
  type: EventType;
  config: ApplicationCommandData | HandlerConfig | TimerConfig;
  init?(instance: NPDBot): Promise<any>;
  listeningFor(payload: BotEvent): boolean;
  callback(payload: BotEvent): Promise<any>;
}

export abstract class BaseHandler {
  static chooseEventTypeFilter(payload: BotEvent): EventType {
    if (payload instanceof CommandInteraction) return EventType.COMMAND;
    if (payload instanceof MessageContextMenuInteraction) return EventType.COMMAND;
    if (payload instanceof Interaction) return EventType.INTERACTION;
    if (payload instanceof GuildMember) return EventType.MEMBER;
    if (payload instanceof Message) return EventType.MESSAGE;
    if (payload instanceof PresenceChange) return EventType.PRESENCE;
    if (payload instanceof Reaction) return EventType.REACTION;
    if (payload instanceof TimerEvent) return EventType.TIMER;
    return EventType.MISC;
  }

  // type: EventType = EventType.MISC;
  constructor(protected botInstance: NPDBot) {}

  config: ApplicationCommandData | HandlerConfig | TimerConfig = {
    name: 'base',
    description: 'Abstract BaseHandler extended to all handlers.'
  };
  
  listeningFor(payload: BotEvent): boolean { return true; }
  async callback(payload: BotEvent): Promise<any> {}
}