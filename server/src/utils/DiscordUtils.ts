import { Client, GuildMember, Message, MessagePayload, MessageTarget, User } from "discord.js";

export class DiscordUtils {
  static async findGuildMember(client: Client, user: User): Promise<GuildMember | Error> {
    const guildFetches = (await client.guilds.fetch());
    if (!guildFetches) return new Error('No guilds registered on client.');

    const fetchMap = guildFetches.map(async guild => await guild.fetch());
    const guilds = await Promise.all(fetchMap);

    const guildMember = guilds.reduce((found, guild) => found || guild.members.resolve(user.id), null as GuildMember | null);
    if (!guildMember) return new Error('Member not found on client guilds.');
    
    return guildMember;
  }

  static createMessagePayload(target: MessageTarget, data: MessagePayload['data'] | Message): MessagePayload {
    const ret = new MessagePayload(target, {});
    ret.data = data as MessagePayload['data'];
    return ret;
  }
}