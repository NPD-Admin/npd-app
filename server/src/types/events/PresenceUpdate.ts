import { Presence } from "discord.js";

export class PresenceUpdate {
  o: Presence | null;
  n: Presence;

  constructor(o: Presence | null, n: Presence) {
    this.o = o; this.n = n;
  }

  toJSON() { return JSON.stringify([this.o, this.n], null, 2); }
}