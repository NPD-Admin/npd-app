import { GuildMember } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { Onboard } from "../shared/Onboard";

export class OnboardMember extends Onboard implements IHandler {
  config = {};

  type: EventType = EventType.MEMBER;

  init(instance: NPDBot): Promise<void> { return super.init(instance) }

  listeningFor(payload: BotEvent): boolean { return true; }

  async callback(payload: BotEvent): Promise<any> {
    await super.assignGuestRole(payload);
    await super.onboardStep(payload);
  }
}