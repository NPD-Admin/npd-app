import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, CommandInteraction } from "discord.js";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";
import { TwitterTracker } from "./TwitterFeeder";

export class TwitterFeederCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  listeningFor(payload: CommandInteraction): boolean { return payload.commandName === this.config.name; }
  config: ChatInputApplicationCommandData = {
    name: 'tweets',
    description: 'Get tweets from saved followers.',
    options: [{
      name: 'account',
      description: 'The account to [un]follow.',
      type: 3
    }]
  }

  async callback(payload: CommandInteraction): Promise<any> {
    const account = payload.options.getString('account');

    if (account) await TwitterTracker.addTracker(payload, account);
    (await TwitterTracker.getTracker(payload.guildId!)).getTweets(payload);
  }
}