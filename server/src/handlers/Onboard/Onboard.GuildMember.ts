import { GuildMember } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, HandlerConfig, IHandler } from "../../types/IHandler";
import { Onboard } from "./Onboard";

export class OnboardMember extends BaseHandler implements IHandler {
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