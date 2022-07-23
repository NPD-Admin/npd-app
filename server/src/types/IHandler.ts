import { ApplicationCommandDataResolvable } from "discord.js";
import { NPDBot } from "../NPDBot";
import { BotEvent, EventType } from "./EventTypes";

export interface IHandler {
  type: EventType;
  config: ApplicationCommandDataResolvable | any;
  init?(payload: NPDBot): Promise<any>;
  listeningFor(payload: BotEvent): boolean;
  callback(payload: BotEvent): Promise<any>;
}