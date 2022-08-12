import { ApplicationCommandDataResolvable, ContextMenuInteraction, MessageApplicationCommandData, MessageContextMenuInteraction } from "discord.js";
import { EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";

export class MotionMessageCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: MessageApplicationCommandData = {
    name: 'Motion',
    type: 3
  }

  listeningFor(payload: MessageContextMenuInteraction): boolean { return (payload.commandName === this.config.name); }

  async callback(payload: MessageContextMenuInteraction): Promise<any> {
    if (payload.isRepliable()) await payload.reply({ ephemeral: true, content: `Motion: ${payload.targetMessage.content}` });
  }
}