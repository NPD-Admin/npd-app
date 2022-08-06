import { CommandInteraction, GuildMember, Message, Role, Snowflake } from "discord.js";
import { Collection, WithId } from "mongodb";
import { NPDBot } from "../../NPDBot";
import { PresenceChange, Reaction } from "../../types/EventTypes";
import { ErrorGenerator } from "../../utils/ErrorGenerator";
import { MongoCollection } from "../../utils/MongoCollection";

type SeenData = {
  guildId: Snowflake;
  userId: Snowflake;
  lastSeen: number;
  seenData?: string;
};

export class SeenTracker {
  static botInstance: NPDBot;
  static presenceCollection: Collection;
  
  static async init(botInstance: NPDBot): Promise<void> {
    if (this.botInstance && this.presenceCollection) return;
    
    this.botInstance = botInstance;
    this.presenceCollection = (await MongoCollection.getCollection('presence')).collection;
  }

  static async update(change: PresenceChange | Message | Reaction): Promise<any> {
    const payload = (change instanceof Message && { userId: change.author.id, guildId: change.guildId })
      || (change instanceof Reaction && { userId: change.u.id, guildId: change.r.message.guildId })
      || (change instanceof PresenceChange
          && ((change.n.status === 'online' || change.o?.status === 'online' && { userId: change.n.userId, guildId: change.n.guild?.id })
            || true))
      || ErrorGenerator.generate(change, 'Invalid SeenTracker update:');
    
    if (!(payload instanceof Error) && (payload !== true))
      return await this.presenceCollection.findOneAndUpdate(
        payload,
        { $set: { lastSeen: Date.now() } },
        { upsert: true }
      );
    else return await Promise.resolve();
  }

  static async getSeenData(payload: CommandInteraction): Promise<any> {
    const who = payload.options.getMentionable('user') as GuildMember | Role;
    const members = (who instanceof GuildMember && [who]) || Array.from((who as Role).members.values());
    const seenData = await this.presenceCollection.find({ guildId: payload.guildId, userId: { $in: members.map(m => m.id) } }).toArray() as WithId<SeenData>[];

    const resData = members.map(m => {
      const userData = seenData.find(s => s.userId === m.id) || {
        userId: m.id,
        guildId: m.guild.id,
        lastSeen: 0
      } as SeenData;

      const presence = payload.guild?.presences.resolve(m.id);
      if (presence?.status === 'online') userData.seenData = '**right now**';
      else if (!userData.lastSeen && !presence) userData.seenData = '*never*';
      else userData.seenData = `at *${new Date(userData.lastSeen).toLocaleString('en-us', { hour12: false, timeZone: 'America/New_York' })}*`;

      return userData;
    });

    if (members.length === 1) return await payload.reply({ ephemeral: true, content: `Last saw <@${resData[0].userId}> ${resData[0].seenData}.` });

    return await payload.reply({
      ephemeral: true,
      embeds: [{
        description: `Last saw <@&${who.id}> at:`,
        fields: [{
          name: 'User:',
          value: resData.map(m => `<@!${m.userId}>`).join('\n'),
          inline: true
        }, {
          name: 'Last Seen:',
          value: resData.map(m => m.seenData).join('\n'),
          inline: true
        }]
      }]
    });
  }
}