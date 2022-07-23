import { ButtonInteraction } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { Onboard } from "../shared/Onboard";

export class OnboardInteraction extends Onboard implements IHandler {
  config: any = {
    name: 'OnboardingAsset',
    description: 'Handle onboarding interactions.'
  };

  type: EventType = EventType.INTERACTION;

  async init(botInstance: NPDBot): Promise<void> { return super.init(botInstance); }

  listeningFor(payload: BotEvent): boolean { return (payload as ButtonInteraction).customId.split('.')[0] === this.config.name }

  async callback(payload: BotEvent): Promise<void | Error> {
    const result = await super.onboardStep(payload);
    if (result instanceof Array<Error>) return new Error(result.map(e => e.message).join('\n'));
  }
}