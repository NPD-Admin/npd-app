import { Collection, GuildScheduledEventCreateOptions, MessageApplicationCommandData, MessageAttachment, MessageContextMenuInteraction, Snowflake } from "discord.js";
import { EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";
import { MongoConnection } from "../../utils/MongoConnection";

const mapsLink = 'https://www.google.com/maps/place/';
const msgParser = /\n?(\w+): *(.+?)(?:\n(?=\w+:)|$)/gs;

type EventData = {
  name: string;
  description: string;
  channel: Snowflake;
  address: string;
  link: string[];
  date: string;
  thumb: Buffer;
  repeat: string;
  repeatDay: {
    day: number,
    week: number,
    freq: number
  };
  guildId: Snowflake;
  eventId: Snowflake;
  reminderMsg: Snowflake;
}

type EventKey = keyof EventData;
type EventValue = string & string[] & Buffer & { day: number, week: number, freq: number };

export class EventMessageCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: MessageApplicationCommandData = {
    name: 'Event',
    type: 3
  };

  listeningFor(payload: MessageContextMenuInteraction): boolean { return payload.commandName === this.config.name; }

  async callback(payload: MessageContextMenuInteraction): Promise<any> {
    const content = payload.targetMessage.content;
    const evtData = {} as EventData;

    let kvPairs;
    while(kvPairs = msgParser.exec(content))
      evtData[kvPairs[1].toLowerCase() as EventKey] = 
        ((kvPairs[1] !== 'link' && kvPairs[2]) || [kvPairs[2]]) as EventValue;
    evtData.thumb = (payload.targetMessage.attachments as Collection<string, MessageAttachment>).first()?.attachment as Buffer;

    const evtPayload: GuildScheduledEventCreateOptions = {
      name: evtData.name,
      description: `${evtData.description}\n \n${evtData.address}\n${mapsLink}${encodeURI(evtData.address)}\n\n${evtData.link.join(' \n')}`,
      entityType: 'VOICE',
      image: evtData.thumb,
      privacyLevel: 'GUILD_ONLY',
      scheduledStartTime: evtData.date,
      channel: /<#(\d+)>/.exec(evtData.channel)![1]
    };

    const existingEvts = await payload.guild?.scheduledEvents.fetch();
    const evt = existingEvts?.find(e =>
      e.scheduledStartTimestamp === new Date(evtPayload.scheduledStartTime).getTime()
      && e.channelId === evtPayload.channel
    );

    if (evt) return await payload.reply({ ephemeral: true, content: `This event conflicts with another in the same channel:\n${evt.url}`});

    const event = await payload.guild?.scheduledEvents.create(evtPayload);
    evtData.guildId = payload.guildId!;
    evtData.eventId = event!.id;

    const evtUrl = await event?.createInviteURL({
      maxAge: 0
    });

    const descParts = evtPayload.description?.split('\n\n');
    descParts!.splice(1, 0, evtUrl!);
    descParts![0] += '\n';
    await event?.setDescription(descParts!.join('\n'));

    if (evtData.repeat) {
      const repeatParts = evtData.repeat.split('/');
      const nextDate = new Date(evtData.date);
      
      if (repeatParts[0].toLowerCase() === 'date') {
        //
      } else if (repeatParts[0].toLowerCase() === 'day') {
        evtData.repeatDay = {
          day: nextDate.getDay(),
          week: Math.floor(nextDate.getDate() / 7)
        } as EventData['repeatDay']

        switch (repeatParts[1].toLowerCase()) {
          case 'monthly':
          default: {
            evtData.repeatDay.freq = 1;
            break;
          }
        }
      }
    }
    
    evtData.reminderMsg = (await payload.channel?.send(`New Event Created: ${evtUrl}`))!.id;
    await payload.reply({ ephemeral: true, content: 'Event Created.' });

    const evtCollection = MongoConnection.getCollection('events');
    await evtCollection.insertOne(evtData);
  }
}