import { GuildMember, Interaction, Message, User } from 'discord.js';
import { TimerEvent } from './TimerEvent';


export enum EventType {
  MISC,
  COMMAND,
  INTERACTION,
  MEMBER,
  MESSAGE,
  TIMER
}

export type TimerConfig = {
  time?: string,
  frequency: number,
  name: string
};

export type BotEvent = Message |
  Interaction |
  GuildMember |
  TimerEvent;