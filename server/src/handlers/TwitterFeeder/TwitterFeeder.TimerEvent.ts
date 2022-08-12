import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler, TimerConfig } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { TwitterTracker } from "./TwitterFeeder";

export class TwitterFeeder extends BaseHandler implements IHandler {
  type: EventType = EventType.TIMER;
  config: TimerConfig = {
    name: 'TwitterFeeder',
    description: 'Check Twitter...',
    frequency: 60*60*1000
  };

  async init(instance: NPDBot): Promise<void> {
    TwitterTracker.init(instance);
    instance.configs.filter(c => c.twitterFeederChannelId).forEach(c => {
      new TimerEvent(`twitter-feeder:${c.guildId}:${c.twitterFeederChannelId}`, this.config.frequency).timeCheck(e => this.callback(e))
    });
  }

  async callback(payload: TimerEvent): Promise<any> {
    console.log(`Getting updated tweets with ${payload.id}`);
    await (await TwitterTracker.getTracker((payload.id as string).split(':')[1])).getTweets(payload);
  }
}