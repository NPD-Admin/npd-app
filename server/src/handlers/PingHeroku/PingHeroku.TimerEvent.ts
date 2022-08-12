import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { ErrorGenerator } from "../../utils/ErrorGenerator";
import { HTTPSRequest } from "../../utils/HTTPSRequest";

export class PingHerokuTimer extends BaseHandler implements IHandler {
  config = {
    name: 'PingHerokuTimer',
    description: 'Pings Heroku Server so it doesn\'t fall asleep.'
  }

  type: EventType = EventType.TIMER;

  async init(i: NPDBot): Promise<void> {
    new TimerEvent('PingHerokuTimer', 300000).timeCheck((e) => this.callback(e));
  }

  async callback(payload: BotEvent): Promise<any> {
    try {
      const res = await HTTPSRequest.httpsGetRequest('https://npd-server.herokuapp.com/api')
        .catch(e => ErrorGenerator.generate({ e, message: 'Error pinging Heroku:' }));
      const response = JSON.parse(res.toString());
      if (!(res instanceof Error)) console.log('Pinged Heroku:', response);
    } catch (e) {
      console.error(`Error pinging Heroku and parsing response:\n${e}`);
    }
  }
}