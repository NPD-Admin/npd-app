import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { IHandler } from "../../types/handlers/IHandler";
import { TimerEvent } from "../../types/events/TimerEvent";
import { TwitterFeeder } from "./TwitterFeeder";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { TimerConfig } from "../../types/handlers/configs/TimerConfig";

export class TwitterFeederTimerEvent extends BaseHandler implements IHandler {
  type: EventType = EventType.TIMER;
  config: TimerConfig = {
    name: 'TwitterFeeder',
    description: 'Check Twitter...',
    frequency: 60*60*1000
  };

  async init(instance: NPDBot): Promise<void> {
    TwitterFeeder.init(instance);
    instance.configs.filter(c => c.twitterFeederChannelId).forEach(c => {
      new TimerEvent(this, { timerSuffix: `${c.guildId}:${c.twitterFeederChannelId}` }).run()
    });
  }

  async callback(payload: TimerEvent): Promise<any> {
    console.log(`Getting updated tweets with ${payload.id}`);
    await (await TwitterFeeder.getTracker((payload.id as string).split(':::')[1].split(':')[0])).getTweets(payload);
  }
}