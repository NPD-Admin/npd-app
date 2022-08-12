import { ChatInputApplicationCommandData, CommandInteraction, GuildMember } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { EventType } from "../../types/events/EventType";
import { BaseHandler } from "../../types/handlers/BaseHandler";
import { IHandler } from "../../types/handlers/IHandler";
import { Onboard } from "./Onboard";

export class OnboardCommand extends BaseHandler implements IHandler {
  config: ChatInputApplicationCommandData = {
    name: 'onboard',
    description: 'Begin the onboarding process.',
    options: [{
      name: 'start',
      description: 'Begin or resume your own onboarding application.',
      type: 1
    }, {
      name: 'list',
      description: 'List completed onboarding applications.',
      type: 1,
      options: [{
        name: 'page',
        description: 'Page of onboarding applications to show.',
        type: 4
      }, {
        name: 'field',
        description: 'Which field to list (default: % complete).',
        type: 3
      }]
    }, {
      name: 'post',
      description: 'Post the initial onboarding message to a channel.',
      type: 1,
      options: [{
        name: 'channel',
        description: 'The channel in which to post the initial onboarding message.',
        type: 7
      }]
    }, {
      name: 'pending',
      description: 'Remind pending members that their onboarding application is incomplete.',
      type: 1,
      options: [{
        name: 'user',
        description: 'Pending member to send the onboarding reminder.',
        type: 6
      }]
    }, {
      name: 'delete',
      description: 'Delete an application.',
      type: 1,
      options: [{
        name: 'user',
        description: 'The user to delete.',
        type: 6,
        required: true
      }]
    }, {
      name: 'edit',
      description: 'Edit an onboarding application.',
      type: 1,
      options: [{
        name: 'user',
        description: 'The user to edit.',
        type: 6
      }]
    }, {
      name: 'view',
      description: 'View the onboarding application for a user.',
      type: 1,
      options: [{
        name: 'user',
        description: 'The user to view.',
        type: 6
      }, {
        name: 'public',
        description: 'Display the record publicly.',
        type: 5
      }]
    }]
  };

  type: EventType = EventType.COMMAND;

  async init(instance: NPDBot): Promise<void> { return Onboard.init(instance); }

  listeningFor(payload: CommandInteraction): boolean {
    return ((payload as CommandInteraction).commandName === this.config.name);
  }

  async callback(payload: CommandInteraction): Promise<void | Error> {

    switch (payload.options.getSubcommand()) {
      case 'start': {
        const result = await Onboard.doOnboarding(payload);
        if (result instanceof Array<Error>) return new Error(result.map(e => e.message).join('\n'));
        break;
      }
      case 'list': {
        await Onboard.postApplicationList(payload);
        break;
      }
      case 'pending': {
        await Onboard.promptIncompleteUsers(payload, payload.options.getMember('user') as GuildMember);
        break;
      }
      case 'post': {
        await Onboard.postFirstAsset(payload);
        break;
      }
      case 'delete': {
        await Onboard.deleteApplication(payload);
        break;
      }
      case 'edit': {
        await Onboard.editApplication(payload);
        break;
      }
      case 'view': {
        await Onboard.postApplication(payload);
        break;
      }
      default: {
        await payload.reply({ ephemeral: true, content: `Invalid subcommand for \`/onboard\`: \`${payload.options.getSubcommand()}\``});
        break;
      }
    }
  }
}