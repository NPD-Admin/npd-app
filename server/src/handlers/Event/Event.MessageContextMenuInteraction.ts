import { ApplicationCommandDataResolvable, Collection, GuildScheduledEventCreateOptions, MessageApplicationCommandData, MessageAttachment, MessageContextMenuInteraction } from "discord.js";
import { BotEvent, EventType } from "../../types/EventTypes";
import { BaseHandler, IHandler } from "../../types/IHandler";

const mapsLink = 'https://www.google.com/maps/place/';

export class Event extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: MessageApplicationCommandData = {
    name: 'Event',
    type: 3
  };

  listeningFor(payload: MessageContextMenuInteraction): boolean { return payload.commandName === this.config.name; }

  async callback(payload: MessageContextMenuInteraction): Promise<any> {
    const content = payload.targetMessage.content;
    const lines = content.split('\n');
    const data = lines.map(l => [,] = l.split(':')).map(l => ({ key: l[0].toLowerCase(), value: l.slice(1).join(':').trim() }));
    const evtData = {
      name: data.find(d => d.key === 'name')?.value,
      date: data.find(d => d.key === 'date')?.value,
      channel: data.find(d => d.key === 'channel')?.value,
      repeat: data.find(d => d.key === 'repeat')?.value,
      address: data.find(d => d.key === 'address')?.value,
      links: data.filter(d => d.key === 'link').map(d => d.value),
      description: data.find(d => d.key === 'description')?.value,
      thumb: (payload.targetMessage.attachments as Collection<string, MessageAttachment>).first()
    };

    const evtPayload: GuildScheduledEventCreateOptions = {
      name: evtData.name!,
      description: evtData.description,
      entityType: 'VOICE',
      image: evtData.thumb?.attachment as Buffer,
      privacyLevel: 'GUILD_ONLY',
      scheduledStartTime: evtData.date!,
      channel: /<#(\d+)>/.exec(evtData.channel!)![1]
    };

    const event = await payload.guild?.scheduledEvents.create(evtPayload);

    await event?.createInviteURL({
      channel: /<#(\d+)>/.exec(evtData.channel!)![1],
      maxAge: 0
    });

    await payload.reply({ ephemeral: true, content: `Event:\n${JSON.stringify(evtData, null, 2)}` });
  }
}