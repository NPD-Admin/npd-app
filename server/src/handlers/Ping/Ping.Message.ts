import { Message } from 'discord.js';

import { EventType } from '../../types/EventTypes';
import { BaseHandler, HandlerConfig, IHandler } from '../../types/IHandler';

export class Ping extends BaseHandler implements IHandler {
  config: HandlerConfig = {
    name: 'ping',
    description: 'Responds to `ping` message.'
  };

  type: EventType = EventType.MESSAGE;

  listeningFor({ content }: Message): boolean { return (content === this.config.name); }

  callback(message: any): Promise<Message<boolean> | void> {
    if (message.content === this.config.name) return message.reply('pong');
    else return Promise.resolve();
  }
}