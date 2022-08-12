import { CommandInteraction, Snowflake, TextChannel } from "discord.js";
import { Collection, ObjectId, WithId } from "mongodb";
import { BotConfig, NPDBot } from "../../NPDBot";
import { TimerEvent } from "../../types/TimerEvent";
import { ErrorGenerator } from "../../utils/ErrorGenerator";
import { HTTPSRequest } from "../../utils/HTTPSRequest";
import { MongoConnection } from "../../utils/MongoConnection";

type TwitterUser = {
  screen_name: string;
  since_id?: string;
  guildId: Snowflake;
};

type Tweet = {
  id_str: string;
  user: {
    screen_name: string;
    name: string;
  }
  retweeted_status?: Omit<Tweet, 'retweeted_status'>;
  type?: 'post' | 'like';
  likedBy?: string;
};

export class TwitterTracker {
  static trackers: Map<Snowflake,TwitterTracker> = new Map<Snowflake,TwitterTracker>();
  static botInstance: NPDBot;

  static async getTracker(guildId: Snowflake): Promise<TwitterTracker> {
    const existing = this.trackers.get(guildId);
    if (existing) return existing;

    const config = await MongoConnection.getCollection('assets').findOne({ type: 'BotConfig', guildId: guildId }) as WithId<BotConfig>;
    
    return this.trackers.set(guildId, new TwitterTracker(guildId, config)).get(guildId)!;
  }

  static async addTracker(payload: CommandInteraction, account: string) {
    const collection = MongoConnection.getCollection('twitter-feeder');
    const existing = await collection.findOne({ guildId: payload.guildId, screen_name: account });
    if (!existing)
      await collection.insertOne({ guildId: payload.guildId, screen_name: account });
    else 
      await collection.deleteOne({ guildId: payload.guildId, screen_name: account });
  }

  static init(botInstance: NPDBot) { this.botInstance = botInstance; }

  constructor(private guildId: Snowflake, private config: BotConfig) {}

  async getTweets(payload: CommandInteraction | TimerEvent): Promise<void | Error> {
    if (payload instanceof CommandInteraction)
      payload.deferReply({ ephemeral: true });
    else {
      const parts = (payload.id as string).split(':');
      const guild = await TwitterTracker.botInstance.client.guilds.fetch(parts[1]);
      const channel = await guild.channels.fetch(parts[2]);
      if (channel?.type === 'GUILD_TEXT')
        (payload as TimerEvent & { channel: TextChannel }).channel = channel;
      else return ErrorGenerator.generate({ e: payload.id, message: 'Configured channel is not a text channel:' });
    }

    const collection = MongoConnection.getCollection('twitter-feeder');
    const users = await collection.find({ guildId: this.guildId }).toArray() as WithId<TwitterUser>[];
    if (!users.length) users.push({ guildId: this.guildId, screen_name: 'NonPartisanDE', _id: new ObjectId() });
    
    const resultMap = new Map<string, Tweet>();
    (await Promise.all(users.map(u => loadTweets(u)))).flat().sort((x, y) => -x.id_str.localeCompare(y.id_str))
      .forEach(r => (!resultMap.has(r.retweeted_status?.id_str || r.id_str)) && resultMap.set(r.retweeted_status?.id_str || r.id_str, r));
    const results = Array.from(resultMap.values());

    await postTweet();

    if (payload instanceof CommandInteraction)
      await payload.editReply({ content: (Array.from(resultMap.values()).length && 'Done.') || 'No new tweets.' });

    async function loadTweets({ screen_name, since_id, guildId }: TwitterUser): Promise<Tweet[]> {
      const count = (since_id && '200') || '10';
      const headers = { 'Content-type': 'application/json' };
      const getPayload = {
        token: process.env.AUTOCODE_TOKEN,
        screen_name,
        since_id,
        count
      };

      const response = JSON.parse((await HTTPSRequest.httpsPayloadRequest(
        'POST',
        'https://nonpartisande.api.stdlib.com/twitter-hook@dev/read-twitter/',
        getPayload, headers
      )).toString()) as { posted: Tweet[], liked: Tweet[] };

      const results = (response.posted.map(t => ({ ...t, type: 'post' })) as Tweet[])
        .concat(response.liked.map(t => ({ ...t, type: 'like', likedBy: screen_name })));

      if (!results.length) return results;

      const newSinceId = results.reduce((p, c) => (p.id_str.localeCompare(c.id_str) >= 0 && p) || c, { id_str: '0', user: { screen_name: '' } } as Tweet).id_str;
      await collection.findOneAndUpdate({ screen_name, guildId }, { $set: { since_id: newSinceId } }, { upsert: true });

      return results;
    }

    async function postTweet() {
      return new Promise<void>(async (resolve, reject) => {
        const tweet = results.pop();
        if (!tweet) return resolve();;

        const rt = (tweet.type === 'post' && tweet.retweeted_status) || tweet;
        const action = (tweet.retweeted_status && 'retweeted') || (tweet.type === 'like' && 'liked') || 'posted';
        await (payload as { channel: TextChannel }).channel
          ?.send(`*@${tweet.likedBy || tweet.user.screen_name} ${action}:*\n>>> https://twitter.com/${rt.user.screen_name}/status/${rt.id_str}`);
        setTimeout(async () => {
          await postTweet();
          resolve();
        }, 5000);
      });
    }
  }
}