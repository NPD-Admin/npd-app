import { ApplicationCommandData } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../events/EventType";
import { BaseHandler } from "./BaseHandler";
import { HandlerConfig } from "./configs/HandlerConfig";
import { TimerConfig } from "./configs/TimerConfig";

export interface IHandler extends BaseHandler {
  type: EventType;
  config: ApplicationCommandData | HandlerConfig | TimerConfig;
  init?(instance: NPDBot): Promise<any>;
  listeningFor(payload: BotEvent): boolean;
  callback(payload: BotEvent): Promise<any>;
}
