import { Constants, Intents, PartialTypes, RecursiveReadonlyArray } from "discord.js";

const INTENTS: RecursiveReadonlyArray<any> = [
  Intents.FLAGS.DIRECT_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Intents.FLAGS.GUILD_PRESENCES,
  Intents.FLAGS.GUILD_VOICE_STATES
];

const PARTIALS: PartialTypes[] = [
  Constants.PartialTypes.CHANNEL
]

export { INTENTS, PARTIALS };