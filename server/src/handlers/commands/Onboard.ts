import { ApplicationCommandDataResolvable, CommandInteraction, GuildMember, TextChannel } from "discord.js";
import { NPDBot } from "../../NPDBot";
import { BotEvent, EventType } from "../../types/EventTypes";
import { IHandler } from "../../types/IHandler";
import { TimerEvent } from "../../types/TimerEvent";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { MongoCollection, WithId } from "../../utils/MongoCollection";
import { Onboard, OnboardingAsset } from "../shared/Onboard";

export class OnboardCommand extends Onboard implements IHandler {
  config: ApplicationCommandDataResolvable = {
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

  async init(instance: NPDBot): Promise<void> { return await super.init(instance); }

  listeningFor(payload: BotEvent): boolean {
    return ((payload as CommandInteraction).commandName === this.config.name);
  }

  async callback(payload: BotEvent): Promise<void | Error> {
    const command = payload as CommandInteraction;

    switch (command.options.getSubcommand()) {
      case 'start': {
        const result = await super.onboardStep(payload as CommandInteraction);
        if (result instanceof Array<Error>) return new Error(result.map(e => e.message).join('\n'));
        break;
      }
      case 'list': {
        await super.postApplicationList(command);
        break;
      }
      case 'pending': {
        await super.promptIncompleteUsers(command, command.options.getMember('user') as GuildMember);
        break;
      }
      case 'post': {
        await super.postFirstAsset(command);
        break;
      }
      case 'delete': {
        await super.deleteApplication(command);
        break;
      }
      case 'edit': {
        await super.editApplication(command);
        break;
      }
      case 'view': {
        await super.postApplication(command);
        break;
      }
      default: {
        await command.reply({ ephemeral: true, content: `Invalid subcommand for \`/onboard\`: \`${command.options.getSubcommand()}\``});
        break;
      }
    }
  }
}