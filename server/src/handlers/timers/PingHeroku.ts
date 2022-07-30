import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { HTTPSRequest } from "../../utils/HTTPSRequest";

export class PingHerokuTimer implements IHandler {
  config = {
    name: 'PingHerokuTimer',
    description: 'Pings Heroku Server so it doesn\'t fall asleep.'
  }

  type: EventType = EventType.TIMER;

  async init(i: NPDBot): Promise<void> {
    new TimerEvent('PingHerokuTimer', 300000).timeCheck((e) => this.callback(e));
  }

  listeningFor(evt: BotEvent) { return true; }

  async callback(payload: BotEvent): Promise<any> {
    const res = await HTTPSRequest.httpsGetRequest('https://npd-server.herokuapp.com/api')
      .catch(e => console.error('Error pinging Heroku:', e));
    if (res) console.log('Pinged Heroku:', JSON.parse(res.toString()));
  }
}