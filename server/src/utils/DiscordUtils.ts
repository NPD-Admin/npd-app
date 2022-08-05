import { Client, GuildMember, Message, MessagePayload, MessageTarget, PermissionFlags, Permissions, User } from "discord.js";
import { ADVISOR_PERMISSIONS, OBSERVER_PERMISSIONS, PARTICIPANT_PERMISSIONS } from "../handlers/commands/Channel";

const FLAGS = Permissions.FLAGS;

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

  static mapPermissions(permissions: Permissions): string[] {
    const permissionValues = [];

    if ((permissions.bitfield & FLAGS.ADMINISTRATOR) === FLAGS.ADMINISTRATOR) {
      permissionValues.push('Admin');
      return permissionValues;
    } else if ((permissions.bitfield & PARTICIPANT_PERMISSIONS) === PARTICIPANT_PERMISSIONS) {
      permissionValues.push('Participant');
      permissionValues.push(permissions.bitfield ^ PARTICIPANT_PERMISSIONS);
    } else if ((permissions.bitfield & ADVISOR_PERMISSIONS) === ADVISOR_PERMISSIONS) {
      permissionValues.push('Advisor');
      permissionValues.push(permissions.bitfield ^ ADVISOR_PERMISSIONS);
    } else if ((permissions.bitfield & OBSERVER_PERMISSIONS) === OBSERVER_PERMISSIONS) {
      permissionValues.push('Observer');
      permissionValues.push(permissions.bitfield ^ OBSERVER_PERMISSIONS);
    } else {
      permissionValues.push('Custom');
      permissionValues.push(permissions.bitfield);
    }
  
    const excessPermissionBits = permissionValues.pop() as bigint;

    const excessPermissions = Object.keys(FLAGS).filter(f => (FLAGS[f as keyof PermissionFlags] & excessPermissionBits) !== BigInt(0)).map(f => f.toString());

    return [...permissionValues as string[], ...excessPermissions];
  }
}