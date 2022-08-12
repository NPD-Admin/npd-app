import { ButtonInteraction } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, HandlerConfig, IHandler } from "../../types/IHandler";
import { Onboard } from "./Onboard";

export class OnboardInteraction extends BaseHandler implements IHandler {
  config: HandlerConfig = {
    name: 'OnboardingAsset',
    description: 'Handle onboarding interactions.'
  };

  type: EventType = EventType.INTERACTION;

  async init(botInstance: NPDBot): Promise<void> { Onboard.init(botInstance); }

  listeningFor(payload: BotEvent): boolean { return (payload as ButtonInteraction).customId.split('.')[0] === this.config.name }

  async callback(payload: ButtonInteraction): Promise<void | Error> {
    const result = await Onboard.doOnboarding(payload);
    if (result instanceof Array<Error>) return new Error(result.map(e => e.message).join('\n'));
  }
}