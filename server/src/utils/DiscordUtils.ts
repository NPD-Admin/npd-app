import { Client, GuildMember, Message, MessagePayload, MessageTarget, PermissionFlags, Permissions, User } from "discord.js";

export const FLAGS = Permissions.FLAGS;

export const OBSERVER_PERMISSIONS =
  FLAGS.VIEW_CHANNEL |
  FLAGS.CONNECT |
  FLAGS.READ_MESSAGE_HISTORY;

export const ADVISOR_PERMISSIONS =
  OBSERVER_PERMISSIONS |
  FLAGS.SPEAK |
  FLAGS.USE_VAD |
  FLAGS.START_EMBEDDED_ACTIVITIES |
  FLAGS.STREAM |
  FLAGS.SEND_MESSAGES |
  FLAGS.ADD_REACTIONS |
  FLAGS.MENTION_EVERYONE |
  FLAGS.ATTACH_FILES |
  FLAGS.EMBED_LINKS |
  FLAGS.USE_EXTERNAL_EMOJIS |
  FLAGS.CREATE_PRIVATE_THREADS |
  FLAGS.CREATE_PUBLIC_THREADS |
  FLAGS.USE_EXTERNAL_STICKERS |
  FLAGS.SEND_MESSAGES_IN_THREADS;

export const PARTICIPANT_PERMISSIONS =
  ADVISOR_PERMISSIONS |
  FLAGS.USE_APPLICATION_COMMANDS;

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
    const permissionValues = { role: 'Custom', excessPermissionBits: permissions.bitfield };

    if ((permissions.bitfield & FLAGS.ADMINISTRATOR) === FLAGS.ADMINISTRATOR) {
      permissionValues.role = 'Admin';
      return [permissionValues.role];
    } else if ((permissions.bitfield & PARTICIPANT_PERMISSIONS) === PARTICIPANT_PERMISSIONS) {
      permissionValues.role = 'Participant';
      permissionValues.excessPermissionBits ^= PARTICIPANT_PERMISSIONS;
    } else if ((permissions.bitfield & ADVISOR_PERMISSIONS) === ADVISOR_PERMISSIONS) {
      permissionValues.role = 'Advisor';
      permissionValues.excessPermissionBits ^= ADVISOR_PERMISSIONS;
    } else if ((permissions.bitfield & OBSERVER_PERMISSIONS) === OBSERVER_PERMISSIONS) {
      permissionValues.role = 'Observer';
      permissionValues.excessPermissionBits ^= OBSERVER_PERMISSIONS;
    }

    const excessPermissions = Object.keys(FLAGS).filter(f =>
      (FLAGS[f as keyof PermissionFlags] & permissionValues.excessPermissionBits) !== BigInt(0));

    return [permissionValues.role, ...excessPermissions];
  }
}