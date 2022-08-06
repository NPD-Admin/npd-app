import { GuildMember, Interaction, Message, MessageReaction, PartialMessageReaction, PartialUser, Presence, User } from 'discord.js';
import { TimerEvent } from './TimerEvent';








export enum EventType {
  MISC,
  COMMAND,
  INTERACTION,
  MEMBER,
  MESSAGE,
  TIMER,
  PRESENCE,
  REACTION
}

export type TimerConfig = {
  time?: string,
  frequency: number,
  name: string
};

export class PresenceChange {
  o: Presence;
  n: Presence;

  constructor(o: Presence, n: Presence) {
    this.o = o; this.n = n;
  }

  toJSON() { return [this.o?.toJSON(), this.n?.toJSON()] }
}

export class Reaction {
  r: MessageReaction | PartialMessageReaction;
  u: User | PartialUser;

  constructor(r: MessageReaction | PartialMessageReaction, u: User | PartialUser) {
    this.r = r; this.u = u;
  }

  toJSON() { return [this.r?.toJSON(), this.u?.toJSON()] }
}

export type BotEvent = Message |
  Interaction |
  GuildMember |
  TimerEvent |
  PresenceChange |
  Reaction;