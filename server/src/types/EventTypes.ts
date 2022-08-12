import { GuildMember, Interaction, Message, MessageReaction, PartialMessageReaction, PartialUser, Presence, User } from 'discord.js';
import { TimerEvent } from './TimerEvent';

export enum EventType {
  MISC,
  COMMAND,
  INTERACTION,
  MEMBER,
  MESSAGE,
  PRESENCE,
  REACTION,
  TIMER
}

export class PresenceChange {
  o: Presence | null;
  n: Presence;

  constructor(o: Presence | null, n: Presence) {
    this.o = o; this.n = n;
  }

  toJSON() { return [this.o?.toJSON(), this.n?.toJSON()] }
}

export class Reaction {
  r: MessageReaction;
  u: User;

  constructor(r: MessageReaction | PartialMessageReaction, u: User | PartialUser) {
    this.r = r as MessageReaction; this.u = u as User;
  }

  toJSON() { return [this.r?.toJSON(), this.u?.toJSON()] }
}

export type BotEvent =
  Message |
  Interaction |
  GuildMember |
  TimerEvent |
  PresenceChange |
  Reaction;