import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler, TimerConfig } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { Onboard } from "./Onboard";

export class OnboardTimer extends BaseHandler implements IHandler {
  config: TimerConfig = {
    name: 'OnboardingReminder',
    description: 'Send reminders to guest users to complete onboarding.',
    frequency: 5000
  };
  type: EventType = EventType.TIMER;

  async init(botInstance: NPDBot): Promise<void> {
    Onboard.init(botInstance);
    const times = await Onboard.getPromptTimes();
    times.forEach((value, key) => new TimerEvent(`${this.config.name}:::${key}`, this.config.frequency, value).timeCheck((e) => this.callback(e)));
  }

  async callback(payload: TimerEvent): Promise<any> {
    Onboard.promptIncompleteUsers(payload);
  }
}