import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/events/EventType";
import { IHandler } from "../../types/handlers/IHandler";
import { TimerEvent } from "../../types/events/TimerEvent";
import { ErrorGenerator } from "../../utils/ErrorGenerator";
import { HTTPSRequest } from "../../utils/HTTPSRequest";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { TimerConfig } from "../../types/handlers/configs/TimerConfig";

export class PingHerokuTimer extends BaseHandler implements IHandler {
  config: TimerConfig = {
    name: 'PingHerokuTimer',
    description: 'Pings Heroku Server so it doesn\'t fall asleep.',
    frequency: 300000
  }

  type: EventType = EventType.TIMER;

  async init(i: NPDBot): Promise<void> {
    new TimerEvent(this).run();
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