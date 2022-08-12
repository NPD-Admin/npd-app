import { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";

export class Reaction {
  r: MessageReaction;
  u: User;

  constructor(r: MessageReaction | PartialMessageReaction, u: User | PartialUser) {
    this.r = r as MessageReaction; this.u = u as User;
  }

  toJSON() { return [this.r?.toJSON(), this.u?.toJSON()] }
}