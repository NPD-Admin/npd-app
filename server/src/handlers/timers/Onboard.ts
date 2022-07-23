import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType, TimerConfig } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { Onboard } from "../shared/Onboard";

export class OnboardTimer extends Onboard implements IHandler {
  config: TimerConfig = {
    name: 'OnboardingReminder',
    frequency: 5000
  };
  type: EventType = EventType.TIMER;

  async init(botInstance: NPDBot): Promise<void> {
    await super.init(botInstance);
    const times = await super.getPromptTimes();
    times.forEach((value, key) => new TimerEvent(`${this.config.name}:::${key}`, this.config.frequency, value).timeCheck((e) => this.callback(e)));
  }

  // NOOP, timer handlers aren't in the discord event queue, but are posted by init through the timeCheck
  listeningFor(payload: BotEvent): boolean { return true; }

  async callback(payload: BotEvent): Promise<any> {
    super.promptIncompleteUsers(payload as TimerEvent);
  }
}