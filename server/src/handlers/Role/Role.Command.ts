import { ApplicationCommandDataResolvable, ChatInputApplicationCommandData, Collection, CommandInteraction, GuildChannel, GuildMember, Role, Snowflake } from "discord.js";
import { BotConfig } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { MongoConnection, WithId } from "../../utils/MongoConnection";

export class RoleCommand extends BaseHandler implements IHandler {
  type: EventType = EventType.COMMAND;
  config: ChatInputApplicationCommandData = {
    name: 'role',
    description: 'Manage roles.',
    options: [{
      name: 'view',
      description: 'View all existing roles.',
      type: 1
    }, {
      name: 'list',
      description: 'List members with the provided role.',
      type: 1,
      options: [{
        name: 'role',
        description: 'The role to list.',
        type: 8,
        required: true
      }]
    }, {
      name: 'clear',
      description: 'Clear this role of all members.',
      type: 1,
      options: [{
        name: 'role',
        description: 'The role to clear.',
        type: 8,
        required: true
      }]
    }, {
      name: 'create',
      description: 'Create a new role.',
      type: 1,
      options: [{
        name: 'name',
        description: 'The role name to create.',
        type: 3,
        required: true
      }]
    }, {
      name: 'delete',
      description: 'Delete a role.',
      type: 1,
      options: [{
        name: 'role',
        description: 'The role to delete.',
        type: 8,
        required: true
      }]
    }, {
      name: 'permissions',
      description: 'Lists the permissions of the role/user.',
      type: 1,
      options: [{
        name: 'role',
        description: 'The role/user to check.',
        type: 9,
        required: true
      }, {
        name: 'page',
        description: 'Page number of 25 results.',
        type: 4
      }]
    }, {
      name: 'add',
      description: 'Add member to role.',
      type: 1,
      options: [{
        name: 'member',
        description: 'Member to add to the role.',
        type: 6,
        required: true
      }, {
        name: 'role',
        description: 'Role to assign the member.',
        type: 8,
        required: true
      }]
    }, {
      name: 'remove',
      description: 'Remove member from role.',
      type: 1,
      options: [{
        name: 'member',
        description: 'Member to remove from the role.',
        type: 6,
        required: true
      }, {
        name: 'role',
        description: 'Role to remove from the member.',
        type: 8,
        required: true
      }]
    }, {
      name: 'copy',
      description: 'Copy members of one role into another.',
      type: 1,
      options: [{
        name: 'source',
        description: 'The role to copy users from.',
        type: 8,
        required: true
      }, {
        name: 'destination',
        description: 'The role to copy users to.',
        type: 8,
        required: true
      }]
    }, {
      name: 'filter',
      description: 'Remove a role from users with another.',
      type: 1,
      options: [{
        name: 'role',
        description: 'The role to remove.',
        type: 8,
        required: true
      }, {
        name: 'filter',
        description: 'The role to filter by.',
        type: 8,
        required: true
      }]
    }, {
      name: 'apply',
      description: 'Apply the permissions of one role to another in every channel.',
      type: 1,
      options: [{
        name: 'source',
        description: 'The role to copy from.',
        type: 8,
        required: true
      }, {
        name: 'destination',
        description: 'The role to copy to.',
        type: 8,
        required: true
      }]
    }]
  };

  listeningFor(evt: CommandInteraction): boolean { return evt.commandName === this.config.name }

  async callback(payload: CommandInteraction): Promise<any> {
    switch (payload.options.getSubcommand(true)) {
      case 'view': {
        return await this.viewRoles(payload);
      }
      case 'list': {
        return await this.listRoleMembers(payload);
      }
      case 'clear': {
        return await this.clearRoleMembers(payload);
      }
      case 'create': {
        return await this.createRole(payload);
      }
      case 'delete': {
        return await this.deleteRole(payload);
      }
      case 'permissions': {
        return await this.listPermissions(payload);
      }
      case 'add': {
        return await this.addRoleMember(payload);
      }
      case 'remove': {
        return await this.removeRoleMember(payload);
      }
      case 'copy': {
        return await this.copyRoleMembers(payload);
      }
      case 'filter': {
        return await this.filterRoleMembers(payload);
      }
      case 'apply': {
        return await this.applyRole(payload);
      }
      default: {
        await payload.reply({ ephemeral: true, content: 'This role subcommand is not yet implemented.' });
      }
    }
  }

  async viewRoles(payload: CommandInteraction): Promise<any> {
    const roles = await payload.guild?.roles.fetch() as Collection<Snowflake, Role>;
    if (!roles) payload.reply({ ephemeral: true, content: 'No roles found.' });

    return await payload.reply({ ephemeral: true, content: roles.sort((x, y) => y.rawPosition - x.rawPosition).map(r => `<@&${r.id}>`).join('\n') });
  }
  
  async listRoleMembers(payload: CommandInteraction): Promise<any> {
    const role = payload.options.getRole('role', true) as Role;
    
    const members = (await payload.guild?.members.fetch())
    ?.filter(m => m.roles.resolve(role.id) !== null);
    
    return await payload.reply({
      ephemeral: true,
      embeds: [{
        fields: [{
          name: `Members of ${role.name}:`,
          value: members?.map(m => m.nickname || m.user.username).join('\n') || 'None.'
        }]
      }]
    });
  }

  async clearRoleMembers(payload: CommandInteraction): Promise<any> {
    await payload.deferReply({ ephemeral: true });

    const role = payload.options.getRole('role', true) as Role;
    
    const members = await payload.guild?.members.fetch();
    if (!(members instanceof Collection<string, GuildMember>))
      return payload.reply({ ephemeral: true, content: 'No guild members found.' });
    
    const roleMembers = members.filter(m => m.roles.resolve(role.id) !== null);

    await Promise.all(roleMembers.map(m => m.roles.remove(role)));

    return await payload.editReply({
      embeds: [{
        fields: [{
          name: `Members cleared from role: ${role.name}`,
          value: roleMembers.map(m => m.nickname || m.user.username).join('\n') || 'None.'
        }]
      }]
    });
  }

  async createRole(payload: CommandInteraction): Promise<any> {
    const role = await payload.guild?.roles.create({
      name: payload.options.getString('name', true)
    });

    if (!role) return await payload.reply({ ephemeral: true, content: `Failed to create role: (${payload.options.getString('name')})`});
    else return await payload.reply({ ephemeral: true, content: `The role <@&${role.id}> as been created.`});
  }

  async deleteRole(payload: CommandInteraction): Promise<any> {
    const role = payload.options.getRole('role', true) as Role;
    await payload.guild?.roles.delete(role);
    return await payload.reply({ ephemeral: true, content: `The role *${role.name}* has been deleted.`});
  }
  
  async listPermissions(payload: CommandInteraction): Promise<any> {
    const role = payload.options.getMentionable('role', true) as Role | GuildMember;
    const page = payload.options.getInteger('page') || 1;
    const channels = (await payload.guild?.channels.fetch() || new Collection<Snowflake,GuildChannel>()).filter(c => c.type !== 'GUILD_CATEGORY')
      .sort((x, y) =>
        ((x.parent?.rawPosition || 0) - (y.parent?.rawPosition || 0))
        || (x.type === 'GUILD_VOICE' && y.type !== 'GUILD_VOICE' && 1)
        || (x.type !== 'GUILD_VOICE' && y.type === 'GUILD_VOICE' && -1)
        || (x.rawPosition - y.rawPosition));

    const permissions = channels.map(c => ({ channel: c, permissions: c.permissionsFor(role) }))
      .filter(c => c.permissions.bitfield !== BigInt(0));

    return await payload.reply({
      ephemeral: true,
      embeds: [{
        title: (role as Role).name || (role as GuildMember).nickname || (role as GuildMember).user.username,
        description: ((permissions.length / 25) > 1 &&`Page ${page} of ${Math.ceil(permissions.length / 25)}`) || undefined,
        fields: permissions?.slice((page - 1) * 25, page * 25).map(p => ({
          name: `Permissions for: ${p.channel.parent?.name || '(~)'} → ${p.channel.name}`,
          value: DiscordUtils.mapPermissions(p.permissions).join(', ')
        }))
      }]
    });
  }

  async addRoleMember(payload: CommandInteraction): Promise<any> {
    const role = payload.options.getRole('role', true) as Role;
    const member = payload.options.getMember('member', true) as GuildMember;
    await member.roles.add(role);
    return await payload.reply({ ephemeral: true, content: `<@!${member.id}> has been added to <@&${role.id}>.` });
  }

  async removeRoleMember(payload: CommandInteraction): Promise<any> {
    const role = payload.options.getRole('role', true) as Role;
    const member = payload.options.getMember('member', true) as GuildMember;

    if (!member.roles.resolve(role.id)) return payload.reply({ ephemeral: true, content: `<@!${member.id}> is not assigned to <@&${role.id}>.`});

    await member.roles.remove(role);

    return await payload.reply({ ephemeral: true, content: `<@!${member.id}> has been removed from <@&${role.id}>.` });
  }
  
  async copyRoleMembers(payload: CommandInteraction): Promise<any> {
    await payload.deferReply({ ephemeral: true });
    const source = payload.options.getRole('source', true) as Role;
    const destination = payload.options.getRole('destination', true) as Role;

    const members = await payload.guild?.members.fetch();
    if (!members) return await payload.reply({ ephemeral: true, content: 'No members found.' });

    const sourceMembers = members.filter(m => m.roles.resolve(source.id) !== null);

    await Promise.all(sourceMembers.map(m => m.roles.add(destination)));

    return await payload.editReply({
      embeds: [{
        description: `Added (${sourceMembers.size}) members from\n\n*${source.name}*\n\nto\n\n*${destination.name}*.`,
        fields: [{
          name: 'Members:',
          value: sourceMembers.map(m => m.nickname || m.user.username).join('\n')
        }]
      }]
    });
  }
  
  async filterRoleMembers(payload: CommandInteraction): Promise<any> {
    await payload.deferReply({ ephemeral: true });
    const role = payload.options.getRole('role', true) as Role;
    const filter = payload.options.getRole('filter', true) as Role;

    const members = await payload.guild?.members.fetch();
    if (!members) return await payload.reply({ ephemeral: true, content: 'No members found.' });

    const filterMembers = members.filter(m => m.roles.resolve(filter.id) !== null && m.roles.resolve(role.id) !== null);

    await Promise.all(filterMembers.map(m => m.roles.remove(role)));

    return await payload.editReply({
      embeds: [{
        description: `Removed (${filterMembers.size}) members with\n\n*${filter.name}*\n\nfrom\n\n*${role.name}*.`,
        fields: [{
          name: 'Members:',
          value: filterMembers.map(m => m.nickname || m.user.username).join('\n')
        }]
      }]
    });
  }
  
  async applyRole(payload: CommandInteraction): Promise<any> {
    const source = payload.options.getRole('source', true) as Role;
    const destination = payload.options.getRole('destination', true) as Role;

    const channels = await payload.guild?.channels.fetch();
    if (!channels) return await payload.reply({ ephemeral: true, content: 'No channels found.' });

    await payload.deferReply({ ephemeral: true });

    const channelsReply: string[] = [];
    await Promise.all(channels.map(c => {
      const overwrites = c.permissionOverwrites;
      const sourceOverwrites = overwrites.cache.get(source.id);
      if (sourceOverwrites) {
        channelsReply.push(c.name);
        const reply = payload.editReply(`Updating channels...\n${channelsReply.join('\n')}`);
        return Promise.all([reply, overwrites.set([...overwrites.cache.values(), { id: destination.id, allow: sourceOverwrites.allow, deny: sourceOverwrites.deny }])]);
      } else return Promise.resolve();
    }));

    return await payload.editReply(`Updated (${channelsReply.length}) channels:\n${channelsReply.join('\n')}`);
  }
}