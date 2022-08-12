import { GuildMember } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { HandlerConfig } from "../../types/handlers/configs/HandlerConfig";
import { IHandler } from "../../types/handlers/IHandler";
import { Onboard } from "./Onboard";

export class OnboardGuildMember extends BaseHandler implements IHandler {
  config: HandlerConfig = {
    name: 'onboard',
    description: 'Handle new guild members.'
  };

  type: EventType = EventType.MEMBER;

  async init(instance: NPDBot): Promise<void> { Onboard.init(instance) }

  async callback(payload: GuildMember): Promise<any> {
    await Onboard.assignGuestRole(payload);
    await Onboard.doOnboarding(payload);
  }
}