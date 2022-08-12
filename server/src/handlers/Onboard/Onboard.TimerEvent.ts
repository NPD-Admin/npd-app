import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { IHandler } from "../../types/handlers/IHandler";
import { TimerEvent } from "../../types/events/TimerEvent";
import { Onboard } from "./Onboard";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { TimerConfig } from "../../types/handlers/configs/TimerConfig";

export class OnboardTimerEvent extends BaseHandler implements IHandler {
  config: TimerConfig = {
    name: 'OnboardingReminder',
    description: 'Send reminders to guest users to complete onboarding.',
    frequency: 5000
  };
  type: EventType = EventType.TIMER;

  async init(botInstance: NPDBot): Promise<void> {
    Onboard.init(botInstance);
    const times = await Onboard.getPromptTimes();
    times.forEach((value, key) => new TimerEvent(this, { timerSuffix: key, setNext: value }).run());
  }

  async callback(payload: TimerEvent): Promise<any> {
    Onboard.promptIncompleteUsers(payload);
  }
}