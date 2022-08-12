import { ApplicationCommandData, ApplicationCommandDataResolvable, CategoryChannel, ChatInputApplicationCommandData, Collection, CommandInteraction, GuildChannel, GuildMember, PermissionFlags, PermissionOverwriteOptions, PermissionOverwrites, Permissions, Role, Snowflake, TextChannel } from "discord.js";
import { BotConfig } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";
import { DiscordUtils, FLAGS, ADVISOR_PERMISSIONS, OBSERVER_PERMISSIONS, PARTICIPANT_PERMISSIONS } from "../../utils/DiscordUtils";
import { MongoConnection, WithId } from "../../utils/MongoConnection";

export class ChannelCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'channel',
    description: 'Manage channels and channel permissions.',
    options: [{
      name: 'sync',
      description: 'Force channel permissions to sync with category permissions.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel/category to sync.',
        type: 7
      }]
    }, {
      name: 'delete',
      description: 'Delete a channel.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel to delete.',
        type: 7,
        required: true
      }]
    }, {
      name: 'archive',
      description: 'Lock a channel and move it to the archives category.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel to archive.',
        type: 7
      }]
    }, {
      name: 'create',
      description: 'Create a new channel.',
      type: 1,
      options: [{
        name: 'category',
        description: 'The category to put the new channel into.',
        type: 7,
        channelTypes: ['GUILD_CATEGORY'],
        required: true
      }, {
        name: 'name',
        description: 'Name of the new channel.',
        type: 3,
        required: true
      }]
    }, {
      name: 'permissions',
      description: 'View permissions on a channel.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel to view.',
        type: 7,
        required: true
      }, {
        name: 'role',
        description: 'The user/role whose permissions to view on the channel.',
        type: 9,
        required: false
      }]
    }, {
      name: 'copy',
      description: 'Copy the permissions from one channel to another.',
      type: 1,
      options: [{
        name: 'source',
        description: 'The channel to copy from.',
        type: 7,
        required: true
      }, {
        name: 'destination',
        description: 'The channel to copy to.',
        type: 7,
        required: true
      }]
    }, {
      name: 'assign',
      description: 'Assign the provided role/user to the channel with the specified permissions.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel to assign.',
        type: 7,
        required: true
      }, {
        name: 'role',
        description: 'The role/user to assign.',
        type: 9,
        required: true
      }, {
        name: 'permissions',
        description: 'The permissions to grant.',
        type: 3,
        choices: [
          ...Object.keys(FLAGS).filter(f => FLAGS[f as keyof PermissionFlags] & PARTICIPANT_PERMISSIONS).map(f => ({
            name: f,
            value: f
          })), {
            name: 'participant',
            value: 'participant'
          }, {
            name: 'advisor',
            value: 'advisor'
          }, {
            name: 'observer',
            value: 'observer'
          }, {
            name: 'none',
            value: 'none'
          }
        ]
      }]
    }]
  };

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name; }

  async callback(payload: CommandInteraction): Promise<any> {
    switch (payload.options.getSubcommand(true)) {
      case 'sync': {
        return await this.syncPermissions(payload);
      }
      case 'delete': {
        return await this.deleteChannel(payload);
      }
      case 'archive': {
        return await this.archiveChannel(payload);
      }
      case 'create': {
        return await this.createChannel(payload);
      }
      case 'permissions': {
        return await this.listChannelPermissions(payload);
      }
      case 'copy': {
        return await this.copyChannelPermissions(payload);
      }
      case 'assign': {
        return await this.assignChannelPermissions(payload);
      }
      default: {
        return await payload.reply({ ephemeral: true, content: 'This subcommand has not been implemented yet.' });
      }
    }
  }

  async syncPermissions(payload: CommandInteraction): Promise<any> {
    const channel = (payload.options.getChannel('channel') || payload.channel) as GuildChannel;

    if (channel.type === 'GUILD_CATEGORY') {
      const channels = (channel as CategoryChannel).children;
      if (!channels) return payload.reply({ ephemeral: true, content: `Category *${channel.name}* has no channels.` });

      await Promise.all(channels.map(c => c.lockPermissions()));

      return await payload.reply({ ephemeral: true, content: `(${channels.size}) channels updated.` });
    } else {
      const r = await channel.lockPermissions();

      return await payload.reply({ ephemeral: true, content: 'Channel updated.' });
    }
  }
  
  async deleteChannel(payload: CommandInteraction): Promise<any> {
    const channel = payload.options.getChannel('channel', true) as GuildChannel;

    await channel.delete();

    return await payload.reply({ ephemeral: true, content: `Channel *#${channel.name}* deleted.` });
  }
  
  async archiveChannel(payload: CommandInteraction): Promise<any> {
    const config = await MongoConnection.getCollection('assets').findOne({ type: 'BotConfig', guildId: payload.guildId }) as WithId<BotConfig>;
    const channel = (payload.options.getChannel('channel') ?? payload.channel) as GuildChannel;

    await channel.setParent(config.archivedChannelCategory[0], { lockPermissions: true });

    if (channel.type === 'GUILD_TEXT') await (channel as TextChannel).send(`Channel locked ${new Date().toISOString()}`);

    return await payload.reply({ ephemeral: true, content: `Channel archived.` });
  }
  
  async createChannel(payload: CommandInteraction): Promise<any> {
    const category = payload.options.getChannel('category', true) as CategoryChannel;
    const name = payload.options.getString('name', true);

    const channel = await category.createChannel(name, {
      type: 'GUILD_TEXT'
    });

    return await payload.reply({ ephemeral: true, content: `Channel <#${channel.id}> created.` });
  }

  async listChannelPermissions(payload: CommandInteraction<import("discord.js").CacheType>): Promise<any> {
    const channel = payload.options.getChannel('channel', true) as GuildChannel;
    const role = payload.options.getMentionable('role') as GuildMember | Role;

    if (role) {
      const permissions = channel.permissionsFor(role);
      return await payload.reply({
        ephemeral: true,
        embeds: [{
          fields: [{
            name: `${(role instanceof Role && role.name) || (role instanceof GuildMember && (role.nickname || role.user.username))}'s permissions in #${channel.name}:`,
            value: DiscordUtils.mapPermissions(permissions).join(', ')
          }]
        }]
      });
    } else {
      await payload.deferReply({ ephemeral: true });

      const allRoles = await payload.guild?.roles.fetch();
      const allMembers = await payload.guild?.members.fetch();

      const rolePermissions = allRoles?.map(r => ({
        type: 'role',
        role: r,
        permissions: channel.permissionsFor(r)
      })).filter(p => p.permissions.bitfield);

      const memberPermissions = allMembers?.map(m => ({
        type: 'member',
        member: m,
        permissions: channel.permissionsFor(m)
      })).filter(p => p.permissions.bitfield);

      const overridingMembers = memberPermissions
        ?.filter(m => !rolePermissions?.find(r => r.permissions.bitfield === m.permissions.bitfield && m.member.roles.resolve(r.role.id)));

      return await payload.editReply({
        embeds: [{
          title: `Permissions in #${channel.name}:`,
          fields: [{
            name: 'Roles:',
            value: rolePermissions?.map(r => r.role.name).join('\n') || 'None.',
            inline: true
          }, {
            name: 'Role Permissions:',
            value: rolePermissions?.map(r => DiscordUtils.mapPermissions(r.permissions).join(', ')).join('\n') || '-',
            inline: true
          }, {
            name: '\u200b',
            value: '\u200b'
          }, {
            name: 'Users:',
            value: overridingMembers?.map(m => m.member.nickname || m.member.user.username).join('\n') || 'None.',
            inline: true
          }, {
            name: 'User Permissions:',
            value: overridingMembers?.map(m => DiscordUtils.mapPermissions(m.permissions).join(', ')).join('\n') || '-',
            inline: true
          }]
        }]
      });
    }
  }
  
  async copyChannelPermissions(payload: CommandInteraction): Promise<any> {
    const source = payload.options.getChannel('source', true) as GuildChannel;
    const destination = payload.options.getChannel('destination', true) as GuildChannel;

    const channelOverwrites = source.permissionOverwrites.cache;
    const overwrites = (source.parent && channelOverwrites.concat(source.parent.permissionOverwrites.cache || new Collection<Snowflake, PermissionOverwrites>()))
      || channelOverwrites;

    await destination.permissionOverwrites.set(overwrites);

    return await payload.reply({ ephemeral: true, content: `Permissions for <#${source.id}> applied to <#${destination.id}>.` });
  }
  
  async assignChannelPermissions(payload: CommandInteraction): Promise<any> {
    const channel = payload.options.getChannel('channel', true) as GuildChannel;
    const role = payload.options.getMentionable('role', true) as Role | GuildMember;
    const permissions = payload.options.getString('permissions') || 'none';

    const roleBits = {
      none: BigInt(0),
      observer: OBSERVER_PERMISSIONS,
      advisor: ADVISOR_PERMISSIONS,
      participant: PARTICIPANT_PERMISSIONS
    }[permissions || 'none'] as bigint;
    const permissionBits = roleBits ?? (FLAGS[permissions as keyof PermissionFlags] || BigInt(0));
    
    if (roleBits === BigInt(0)) {
      await channel.permissionOverwrites.delete(role);
    } else if (roleBits) {
      await channel.permissionOverwrites.set([...channel.permissionOverwrites.cache.values(), { id: role.id, allow: roleBits }]);
    } else {
      const overwrites = channel.permissionOverwrites.cache.get(role.id);

      const currentPermissions = overwrites?.allow.bitfield || BigInt(0);
      const newPermissions = ((currentPermissions & permissionBits) && (currentPermissions & ~permissionBits)) || (currentPermissions | permissionBits);

      await channel.permissionOverwrites.set([...channel.permissionOverwrites.cache.values(), { id: role.id, allow: newPermissions }]);
    }

    payload.reply({
      ephemeral: true,
      content: `Permissions for ${(role as Role).name || (role as GuildMember).nickname || (role as GuildMember).user.username} updated.`
    });
  }

  parsePermissionBits(permissionBits: bigint): PermissionOverwriteOptions {
    const overwrite = {} as PermissionOverwriteOptions;
    Object.keys(FLAGS).forEach(f => {
      if ((permissionBits & FLAGS[f as keyof PermissionFlags]) !== BigInt(0))
        overwrite[f as keyof PermissionOverwriteOptions] = true;
    });
    return overwrite;
  }
}