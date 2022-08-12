import { GuildMember, Interaction, Message, MessageReaction, PartialMessageReaction, PartialUser, Presence, User } from 'discord.js';
import { PresenceUpdate } from './PresenceUpdate';
import { Reaction } from './Reaction';
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





export type BotEvent =
  Message |
  Interaction |
  GuildMember |
  TimerEvent |
  PresenceUpdate |
  Reaction;