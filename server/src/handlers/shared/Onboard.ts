import {
  ButtonInteraction,
  CommandInteraction,
  DiscordAPIError,
  EmbedField,
  Guild,
  GuildMember,
  GuildMemberRoleManager,
  Interaction,
  InteractionReplyOptions,
  Message,
  MessagePayload,
  ModalOptions,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  Snowflake,
  TextChannel,
  TextInputComponent,
  User
} from "discord.js";

import { NPDBot } from "../../NPDBot";
import { BotEvent } from "../../types/EventTypes";
import { TimerEvent } from "../../types/TimerEvent";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { GeoLookup } from "../../utils/GeoLookup";
import { GoogleClient } from "../../utils/Google/GoogleClient";
import { Mailer } from "../../utils/Mailer";
import { MailerLite } from "../../utils/MailerLite";
import {
  Collection,
  WithId,
  MongoCollection
} from "../../utils/MongoCollection";
import { AddressValidator, EmailValidator, PhoneNumberValidator } from "../../utils/Validation";

type MemberRecord = {
  discordUserId: Snowflake,
  guildId: Snowflake,
  guildMemberId: Snowflake,
  started: number,
  nickname: string,
  legalName: string,
  legalAddress: string,
  email: string,
  emailVerificationCode: string,
  emailVerification: string,
  emailVerified: boolean,
  sms: string,
  voice: string,
  social: string[],
  contactVerified: number,
  feedback: string,
  completed: number,
  edit?: boolean | { $exists: false },
  pComplete?: number
};

type MemberResolvable = { user: User, guild?: Guild, member?: GuildMember } | Interaction;

type OnboardingConfig = {
  type: "OnboardingConfig",
  channelId: Snowflake,
  guildId: Snowflake,
  completedRoleId: Snowflake,
  manageRoleId: Snowflake,
  guestRoleId: Snowflake,
  promptTime: string,
  mailerGroupId: string
};

export type OnboardingAsset = {
  type: "OnboardingAsset",
  guildId: Snowflake,
  identifier: string,
  fieldMapping: Array<keyof MemberRecord>,
  order: number,
  msgJson?: MessagePayload['data'] & Message,
  modalJson?: ModalOptions
};

type TextInputComponentDef = Omit<TextInputComponent, 'customId'> & { custom_id: string };

type MessageAsset = {
  type: "PruningMessageAsset" | "MessageAsset",
  identifier?: string,
  guildId: Snowflake,
  msgJson: MessagePayload['data'] & Message | InteractionReplyOptions
};

type OnboardingReminderAsset = Omit<MessageAsset, 'type'> & {
  type: "OnboardingReminderAsset",
  onboardingChannelId: Snowflake
};

const retryMessage = {
  content: 'There was an error processing your responses.$$Click the button below to retry.',
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          label: 'Retry',
          custom_id: 'OnboardingAsset.RETRY',
          style: 1
        }
      ]
    }
  ]
} as InteractionReplyOptions;

export abstract class Onboard {
  private static botInstance: NPDBot | null;
  private static assetCollection: Collection;
  private static memberCollection: Collection;

  async init(botInstance: NPDBot): Promise<void> {
    if (Onboard.botInstance) return;
    Onboard.botInstance = botInstance;
    Onboard.assetCollection = (await MongoCollection.getCollection('assets')).collection;
    Onboard.memberCollection = (await MongoCollection.getCollection('members')).collection;
  }

  async onboardStep(event: BotEvent): Promise<void | Error[]> {
    if (!Onboard.botInstance) return console.error('Onboarding as not been initialized.');

    const payload = this.extractMemberResolvable(event) as MemberResolvable;
    if (payload instanceof Error) return console.error(payload.message);

    const memberRecord = await this.getMemberRecord(payload);
    const guildMember = await this.loadGuildMemberData(payload, memberRecord);
    if (guildMember instanceof Error) return console.error(guildMember.message);

    const onboardConfig = await Onboard.assetCollection.findOne({
      type: 'OnboardingConfig',
      guildId: guildMember.guild.id
    }) as WithId<OnboardingConfig>;
    if (!onboardConfig) return console.error('No OnboardingConfig found for this guild.');
    
    const onboardAssets = (await Onboard.assetCollection.find({
      type: 'OnboardingAsset',
      guildId: onboardConfig.guildId
    }).toArray()) as WithId<OnboardingAsset>[];

    const currentAsset = onboardAssets.sort((x, y) => x.order - y.order)
      .find(asset => asset.fieldMapping.some(c => !Object.keys(memberRecord).includes(c) || !memberRecord[c]));
    if (!currentAsset) return console.error('No assets found:\n'+JSON.stringify(memberRecord, null, 2));

    const handlerResult = await this.handleInteraction(payload, memberRecord, currentAsset, onboardConfig);
    if (memberRecord.completed) {
      await guildMember.roles.add(onboardConfig.completedRoleId);
      await guildMember.roles.remove(onboardConfig.guestRoleId);
    }
    if (memberRecord.nickname && memberRecord.nickname !== guildMember.nickname) guildMember.setNickname(memberRecord.nickname).catch(e => {
      if ((e as DiscordAPIError).code === 50013) {
        console.error('No permissions to edit member nickname.  Is this the guild admin?');
      }
    });
    
    const nextAsset = onboardAssets.sort((x, y) => x.order - y.order)
      .find(asset => asset.fieldMapping.some(c => !Object.keys(memberRecord).includes(c) || !memberRecord[c]));
    if (!nextAsset) return console.error('No more assets found:\n'+JSON.stringify(memberRecord, null, 2));

    if (nextAsset.modalJson) this.populateFields(nextAsset, memberRecord);

    if (handlerResult.length) {
      const errorMessage = Object.assign({}, retryMessage);
      errorMessage.content = errorMessage.content?.replace('$$', `\n\n${handlerResult.map(e => e.message).join('\n')}\n\n`);
      if (payload instanceof Interaction && payload.isRepliable()) {
        await payload.reply({ ...errorMessage, ephemeral: (payload as Interaction).channel?.type !== 'DM'});
      } else {
        await payload.user.send(errorMessage as MessagePayload);
      }
    } else if ((payload instanceof ModalSubmitInteraction || payload instanceof GuildMember) && nextAsset.modalJson) {
      const errorMessage = Object.assign({}, retryMessage);
      errorMessage.content = errorMessage.content!.replace('$$', '\n\nFailed to load the next onboarding asset.\n\n')
      const userVsGuildError = (currentAsset !== nextAsset && {
        content: 'Onboarding through Discord does not support modal responses for this event.  Contact a Guild Administrator.'
      }) || errorMessage;
      if (payload instanceof Interaction && payload.isRepliable())
        await payload.reply({ ...userVsGuildError, ephemeral: (payload as Interaction).channel?.type !== 'DM'});
      console.error('Error saving responses, cannot advance from ModalInteraction to showModal.');;
    } else if (nextAsset.msgJson) {
      await this.sendMessageStep(payload, nextAsset, onboardConfig);
    } else if (nextAsset.modalJson) {
      await (payload as ButtonInteraction & CommandInteraction).showModal(nextAsset.modalJson);
    }
  }

  private extractMemberResolvable(event: BotEvent): MemberResolvable | Error {
    const payload = 
      ((event instanceof CommandInteraction)      && (event as CommandInteraction))     ||
      ((event instanceof ButtonInteraction)       && (event as ButtonInteraction))      ||
      ((event instanceof ModalSubmitInteraction)  && (event as ModalSubmitInteraction)) ||
      ((event instanceof SelectMenuInteraction)   && (event as SelectMenuInteraction))  ||
      ((event instanceof GuildMember)             && (event as GuildMember))            ||
      ((event instanceof Message)                 && (event as Message & { user: User }));
    
    const errorMsg = ((event instanceof TimerEvent))
    if (!payload) return new Error('Invalid event submitted to Onboard.onboardStep({event}).\n' + event.toJSON());
    if (payload instanceof Message) payload.user = payload.author;
    return payload as MemberResolvable;
  }

  private async getMemberRecord(payload: { user: User }, edit: boolean = false): Promise<WithId<MemberRecord>> {
    const memberPayload = { discordUserId: payload.user.id, edit: { $exists: edit } } as WithId<MemberRecord>;
    delete memberPayload.edit;
    const foundMember = await Onboard.memberCollection.findOne(memberPayload) as WithId<MemberRecord>;

    if (!foundMember) memberPayload._id = (await Onboard.memberCollection.insertOne(memberPayload)).insertedId;
    return (foundMember ?? memberPayload) as WithId<MemberRecord>;
  }

  private async loadGuildMemberData(payload: MemberResolvable, memberRecord: WithId<MemberRecord>): Promise<GuildMember | Error> {
    if (!Onboard.botInstance) return new Error('Onboarding has not been initialized.');

    const guildMember = await this.findGuildMember(payload);

    if (guildMember && guildMember instanceof GuildMember) {
      memberRecord.guildId = guildMember.guild.id;
      memberRecord.guildMemberId = guildMember.id;
      payload.member = guildMember;
      return guildMember;
    } else if (guildMember instanceof Error) return new Error(`Error finding Guild / Member information for onboarding:\n${guildMember.message}`);
      else return new Error(`Unknown error finding Guild / Member information for onboarding:\n${guildMember}`);
  }

  private async findGuildMember(payload: MemberResolvable): Promise<GuildMember | Error> {
    if (!Onboard.botInstance) return new Error('Onboarding has not been initialized.');
    let guildMember;
    if (payload.member && payload.member instanceof GuildMember) guildMember = payload.member;
    else if (payload.guild && payload.guild instanceof Guild) guildMember = payload.guild.members.resolve(payload.user) as GuildMember;
    else guildMember = await DiscordUtils.findGuildMember(Onboard.botInstance.client, payload.user) as GuildMember;
    return guildMember;
  }

  private async handleInteraction(payload: MemberResolvable, memberRecord: WithId<MemberRecord>, currentAsset: OnboardingAsset, config: OnboardingConfig): Promise<Error[]> {
    if (!(payload instanceof ButtonInteraction || payload instanceof ModalSubmitInteraction || payload instanceof SelectMenuInteraction)) return Promise.resolve([]);
    const errors = [] as Error[];

    const data = this.extractInteractionValues(payload as ModalSubmitInteraction, currentAsset);
    const customId = payload.customId.split('.').filter((v, i, a) => (((isNaN(Number(a[a.length-1])) && 3) || 2) === a.length) || a.length === 2 || i !== 1).join('.');

    if (customId === 'OnboardingAsset.0000.started') {

      memberRecord.started = Date.now();
      if (payload.message?.channel.type !== 'GUILD_TEXT')
        payload.message?.delete();

    } else if (customId === 'OnboardingAsset.0000.leave') {

      payload.member.kick('Requested');

    } else if (customId === 'OnboardingAsset.0001') {

      if (this.validateNickname(data.nickname)) {
        memberRecord.nickname = data.nickname;
        await payload.member.setNickname(data.nickname).catch(e => {
          if ((e as DiscordAPIError).code === 50013) {
            console.error('No permissions to edit member nickname.  Is this the guild admin?');
          }
        });
      } else errors.push(new Error(`Invalid nickname: ${data.nickname || '*empty*'}`));

      if (data.legalAddress) {
        const [name, address] = await AddressValidator.parse(data.legalAddress);
        if (name instanceof Error) {
          errors.push(name);
        } else {
          memberRecord.legalName = name;
          memberRecord.legalAddress = address!.address;
        }
      } else memberRecord.legalName = memberRecord.legalAddress = `Declined: ${Date.now()}`;

      if (EmailValidator.test(data.email) && data.email !== memberRecord.email) {
        const verificationCode = Math.floor(Math.random()*1e6).toString().padStart(6, '0');
        memberRecord.email = data.email;
        memberRecord.emailVerificationCode = verificationCode;
        Mailer.sendMail(
          `Your email verification code is: ${verificationCode}`,
          data.email,
          'Non-Partisan Delaware Email Verification'
        );
      } else if (data.email !== memberRecord.email)
        errors.push(new Error(`Invalid email address: ${data.email || '*empty*'}`));

    } else if (customId === 'OnboardingAsset.0002.emailVerified') {

      memberRecord.emailVerified = true;
      payload.message?.delete();

    } else if (customId === 'OnboardingAsset.0003') {

      if (data.emailVerification === memberRecord.emailVerificationCode) {
        memberRecord.emailVerification = data.emailVerification;
        await MailerLite.addGroupMember(config.mailerGroupId, memberRecord.email);
      } else errors.push(new Error('Your email verification code did not match.'))

      const smsNumberParts = PhoneNumberValidator.exec(data.sms);
      if (smsNumberParts) {
        memberRecord.sms = `${smsNumberParts[1]}.${smsNumberParts[2]}.${smsNumberParts[3]}`
      } else if (!data.sms) {
        memberRecord.sms = `Declined: ${Date.now()}`;
      } else errors.push(new Error(`Invalid SMS number: "${data.sms}"`));

      const voiceNumberParts = PhoneNumberValidator.exec(data.voice);
      if (voiceNumberParts) {
        memberRecord.voice = `${voiceNumberParts[1]}.${voiceNumberParts[2]}.${voiceNumberParts[3]}`
      } else if (!data.voice) {
        memberRecord.voice = `Declined: ${Date.now()}`;
      } else errors.push(new Error(`Invalid voice number: "${data.voice}"`));

      if (data.social) {
        memberRecord.social = data.social.split('\n')
      } else {
        memberRecord.social = [`Declined: ${Date.now()}`];
      }

    } else if (customId === 'OnboardingAsset.0004.verifyContact') {

      console.log((payload as SelectMenuInteraction).values);

    } else if (customId === 'OnboardingAsset.0004.contactVerified') {

      memberRecord.contactVerified = Date.now();
      payload.message?.delete();

    } else if (customId === 'OnboardingAsset.0005') {

      if (data.feedback) memberRecord.feedback = data.feedback;
      else memberRecord.feedback = `Declined: ${Date.now()}`;
      memberRecord.completed = Date.now();

    } else if (customId === 'OnboardingAsset.0006.view') {

      const msg = await this.applyTemplate(memberRecord, payload as ButtonInteraction);
      await payload.reply(msg);

    } else if (customId === 'OnboardingAsset.RETRY') {

      await payload.message?.delete();
      return [];

    }
    else return [new Error(`Interaction Custom ID not handled: ${payload.customId}: ${customId}`)];

    await Onboard.memberCollection.updateOne({ _id: memberRecord._id }, { $set: memberRecord });

    return errors;
  }

  async applyTemplate(memberRecord: WithId<MemberRecord>, payload: CommandInteraction | ButtonInteraction): Promise<InteractionReplyOptions> {
    const template = await Onboard.assetCollection.findOne({ type: 'OnboardingViewTemplate', guildId: (payload.member! as GuildMember).guild!.id }) as WithId<MessageAsset>;
    if (!template) return { ephemeral: true, content: JSON.stringify(memberRecord, null, 2)};
    else {
      const msg = template.msgJson;
      if (!msg.embeds) return msg as InteractionReplyOptions;
      msg.embeds![0].title = msg.embeds[0].title!
        .replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => (memberRecord[hits[0] as keyof Omit<MemberRecord, 'edit'>] || '').toString()) ?? '*Incomplete*';
      msg.embeds[0].timestamp = Number(msg.embeds[0].timestamp!.toString()
        .replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => (memberRecord[hits[0] as keyof Omit<MemberRecord, 'edit'>] || '').toString())) ?? Date.now();
      msg.embeds[0].description = msg.embeds[0].description!
        .replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => (memberRecord[hits[0] as keyof Omit<MemberRecord, 'edit'>] || '').toString()) ?? '';
      const pieces = msg.embeds[0].description.split(', ').map(i => i.trim());
      if (pieces.length >= 4) {
        const addr1 = pieces.slice(0, pieces.length - 3);
        const addr2 = pieces.slice(pieces.length - 3);
        msg.embeds[0].description = `${addr1.join(', ')}\n${addr2[0]}, ${addr2[1]} ${addr2[2]}`;
      } else {
        msg.embeds[0].description = '*Incomplete*';
      }
      msg.embeds[0].fields = (msg.embeds[0].fields! as EmbedField[]).map(field => ({
        ...field,
        value: field.value.replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => {
          if (hits[0] !== 'social') return (memberRecord[hits[0] as keyof Omit<MemberRecord, 'edit'>] || '*Incomplete*').toString();
          else return ((memberRecord[hits[0] as keyof Omit<MemberRecord, 'edit'>] || []) as Array<string>).join('\n') || '*Incomplete*';
        }) ?? ''
      }));
      return msg as InteractionReplyOptions;
    }
  }

  private validateNickname(nickname: string): boolean {
    return !!nickname;
  }

  private extractInteractionValues(payload: ModalSubmitInteraction, currentAsset: OnboardingAsset): Omit<MemberRecord, 'social'> & { social: string } {
    if (!(payload instanceof ModalSubmitInteraction)) return {} as Omit<MemberRecord, 'social'> & { social: string };
    const data = {} as Omit<MemberRecord, 'social'> & { social: string };
    currentAsset.fieldMapping.forEach(key => data[key] = payload.fields.getTextInputValue(`${payload.customId}.${key}`) as never);
    return data;
  }

  private populateFields(nextAsset: WithId<OnboardingAsset>, memberRecord: WithId<MemberRecord>) {
    nextAsset.modalJson!.components.forEach(row => {
      const input = row.components[0] as TextInputComponentDef;
      const key = input.custom_id.split('.').pop()! as keyof MemberRecord;
      const memberDataItem = ((memberRecord[key] instanceof Array) && (memberRecord[key] as Array<string>).join('\n'))
        || memberRecord[key] as string;
      if (memberRecord[key]) input.value = memberDataItem;
      else input.value = '';
    })
  }

  private async sendMessageStep(
    payload: GuildMember | MemberResolvable | ModalSubmitInteraction,
    nextAsset: WithId<OnboardingAsset>,
    config: OnboardingConfig
  ): Promise<void> {
    this.fillVariables(nextAsset, payload, config);
    const msg = DiscordUtils.createMessagePayload(payload.user, nextAsset.msgJson!);

    if (payload instanceof Interaction && payload.isRepliable()) {
      if (payload.channel?.type === 'GUILD_TEXT') {
        await payload.user.send(msg);
        await payload.reply({ ephemeral: true, content: 'Check your private messages.' });
      } else if (!payload.replied) {
        await payload.reply(msg);
      }
    } else if (payload instanceof Message) {
      await payload.user.send(msg);
      if (payload.channel.type !== 'DM')
        await payload.reply({ content: 'Check your private messages.' });
    } else if (payload instanceof GuildMember) {
      await payload.user.send(msg);
    }
  }

  private fillVariables(asset: OnboardingAsset, payload: MemberResolvable, config: OnboardingConfig): void {
    const mapping = (payload instanceof CommandInteraction &&  ((substring: string, ...hits: any[]) => {
      if ((hits[0] as string).toLowerCase().includes('roleid'))
        return `\`@${(payload.member as GuildMember)?.guild.roles.resolve(config[hits[0] as keyof OnboardingConfig])?.name}\``;
      return config[hits[0] as keyof OnboardingConfig];
    })) || ((substring: string, ...hits: any[]) => `<@&${config[hits[0] as keyof OnboardingConfig]}>`);
     
    asset.msgJson!.embeds[0].description = asset.msgJson!.embeds[0].description!
      .replace(/\$\$(\w+)\$\$/g, mapping);
  }

  async postApplicationList(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId))
      return command.reply({ ephemeral: true, content: 'You do not have permission to list onboarding applications.' });
    
    const memberRecordsCursor = Onboard.memberCollection.aggregate([{
      $set: { numFields: { $size: { $objectToArray: '$$ROOT' } } }
    }, {
      $set: { pComplete: { $multiply: [{ $divide: [ '$numFields', 18 ] }, 100] } }
    }, {
      $sort: { 'pComplete': -1 }
    }]);
    const memberRecordsCount = await Onboard.memberCollection.countDocuments();
    const memberRecords = (await memberRecordsCursor
      .skip((((command.options.getInteger('page') || 1) - 1) || 0) * 10)
      .limit(10).toArray() as WithId<MemberRecord>[]);

    const field = command.options.getString('field') as keyof MemberRecord;
    const fieldMapping = (record: WithId<MemberRecord>): string => ((!field && `(${record.pComplete?.toFixed(1)}%)`) || record[field]?.toString()) || '*Incomplete*';
    const memberList = memberRecords.map(record => `<@${record.discordUserId}>`).join('\n');
    const completeList = memberRecords.map(fieldMapping).join('\n');
    await command.reply({
      ephemeral: true,
      embeds: [{
        description: `Page (${command.options.getInteger('page') || 1} / ${Math.ceil(memberRecordsCount / 10)})`,
        fields: [{
          name: 'Members',
          value: memberList || 'No additional Records',
          inline: true
        }, {
          name: '% Complete',
          value: completeList || '*',
          inline: true
        }]
      }]
    })
  }

  async postFirstAsset(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId))
      return command.reply({ ephemeral: true, content: 'You do not have permission to post onboarding applications.' });

    await command.deferReply();
    const channel = (command.options.getChannel('channel') ?? command.channel) as TextChannel;
    const asset = await Onboard.assetCollection.findOne({ type: 'OnboardingAsset', order: 0 }) as WithId<OnboardingAsset>;
    if (asset.msgJson) this.fillVariables(asset, command, config);
    await channel.send(DiscordUtils.createMessagePayload(channel, asset.msgJson!));
    await command.deleteReply()
  }

  async deleteApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId))
      return command.reply({ ephemeral: true, content: 'You do not have permission to delete onboarding applications.' });

    const result = await Onboard.memberCollection.deleteMany({ discordUserId: command.options.getUser('user', true).id });
    await command.reply({ ephemeral: true, content: `Deleted (${result.deletedCount}) applications for user.`});
  }

  async editApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    const user = command.options.getUser('user') ?? command.user;

    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId) && command.member!.user !== user)
      return command.reply({ ephemeral: true, content: 'You do not have permission to edit others\' onboarding applications.'});

    const editRecord = await this.getMemberRecord(command, true);
    await this.onboardStep(command);
  }

  async postApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    const user = command.options.getUser('user') ?? command.user;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId) && command.member!.user !== user)
      return command.reply({ ephemeral: true, content: 'You do not have permission to view others\' onboarding applications.' });

    const application = await Onboard.memberCollection.findOne({ discordUserId: user.id }) as WithId<MemberRecord>;
    if (!application) return await command.reply({ ephemeral: true, content: `No application exists for User: <@${user.id}>`});

    const msg = await this.applyTemplate(application, command);
    await command.reply({ ...msg, ephemeral: !command.options.getBoolean('public') });
  }
  
  async assignGuestRole(payload: BotEvent): Promise<void> {
    const member = payload as GuildMember;
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: member.guild!.id }) as WithId<OnboardingConfig>;
    await member.roles.add(config.guestRoleId);
  }

  async getPromptTimes(): Promise<Map<Snowflake, string>> {
    const configs = await Onboard.assetCollection.find({ type: 'OnboardingConfig' }).toArray() as WithId<OnboardingConfig>[];
    const ret = new Map<Snowflake, string>();
    configs.forEach(config => ret.set(config.guildId, config.promptTime));
    return ret;
  }

  async promptIncompleteUsers(evt: TimerEvent | CommandInteraction, member?: GuildMember | null): Promise<void> {
    if (evt instanceof TimerEvent) console.log('Prompting incomplete users.');
    const guildId = (evt instanceof CommandInteraction && evt.guild!.id) || (evt.id as string).split(':::')[1];
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId }) as WithId<OnboardingConfig>;
    if (!config) return console.error(`No config found for event Guild: ${guildId}`);

    if (evt instanceof CommandInteraction) {
      if (!(evt.member!.roles as GuildMemberRoleManager).resolve(config.manageRoleId))
        return evt.reply({ ephemeral: true, content: 'You do not have permission to force an onboarding reminder.' });
    }

    const asset = await Onboard.assetCollection.findOne({ type: 'OnboardingAsset', guildId, order: 0 }) as WithId<OnboardingAsset>;
    const reminderMsg = await Onboard.assetCollection.findOne({ type: 'OnboardingReminderAsset', guildId }) as WithId<OnboardingReminderAsset>;
    reminderMsg.msgJson.embeds![0].description = reminderMsg.msgJson.embeds![0].description!
      .replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => `<#${reminderMsg[hits[0] as keyof OnboardingReminderAsset]}`);

    if (member instanceof GuildMember) {
      console.log(`Prompting one user: ${member.nickname || member.user.username}`);
      if (asset.msgJson) this.fillVariables(asset, member, config);
      const channel = await member.createDM();
      await channel.send(DiscordUtils.createMessagePayload(channel, asset.msgJson!)).catch(console.error);
      return await (evt as CommandInteraction).reply({ ephemeral: true, content: `Onboarding message sent to <@${member.user.id}>.`});
    }

    const guild = (evt instanceof CommandInteraction && evt.guild!) || Onboard.botInstance?.client.guilds.resolve(config.guildId);

    const members = await guild?.members.fetch();
    if (!members) return console.error(`No members found in Guild: ${guild?.name} (${guild?.id})`);

    // await guild?.members.prune({
    //   days: 7,
    //   roles: [config.guestRoleId],
    //   reason: `Guest Inactivity`,
    //   dry: true
    // });

    const activeMembers = await guild?.members.fetch();
    const prunedMembers = members.filter(member => !activeMembers?.has(member.id));
    console.log('Pruned Members:\n', prunedMembers.map(m => m.user.username).join('\n'), `\n(${prunedMembers.size}) members pruned.`);

    if (!activeMembers) return console.error(`No members found in Guild: ${guild?.name} (${guild?.id})`);
    const memberIds = Array.from<any>(activeMembers.keys()) as Array<Snowflake>;
    const memberRecords = await Onboard.memberCollection.find({
      guildMemberId: {
        $in: memberIds
      },
      completed: {
        $exists: true,
        $gt: 0
      }
    }).toArray() as WithId<MemberRecord>[];

    const completedMemberIds = memberRecords.map(record => record.guildMemberId);
    const incompleteMembers = activeMembers.filter(member => !completedMemberIds.includes(member.id)).filter(m => !m.user.bot);
    const completedMembers = activeMembers.filter(member => completedMemberIds.includes(member.id));

    await Onboard.botInstance?.getConfig(guildId)?.logChannel?.send([
      'Onboarding Incomplete for:',
      incompleteMembers.map(member => member.nickname || member.user.username).join('\n'),
      `(${incompleteMembers.size}) members incomplete.`
    ].join('\n'));
    await Onboard.botInstance?.getConfig(guildId)?.logChannel?.send([
      'Onboarding Complete for:',
      completedMembers.map(member => member.nickname || member.user.username).join('\n'),
      `(${completedMembers.size}) members complete.`
    ].join('\n'));
    await Promise.all(incompleteMembers.map(async m => {
      if (asset.msgJson) this.fillVariables(asset, m, config);
      const channel = await m.createDM();
      await channel.send(DiscordUtils.createMessagePayload(channel, asset.msgJson!)).catch(e => {
        if (e instanceof DiscordAPIError) {
          console.error(`Failed to send onboarding message to: ${m.user.username}\n`)
        } else {
          console.error('Unknown Error:\n', e);
        }
      });
      await channel.send(DiscordUtils.createMessagePayload(m, reminderMsg.msgJson as MessagePayload['data'])).catch(e => {
        if (e instanceof DiscordAPIError) {
          console.error(`Failed to send pruning reminder to: ${m.user.username}\n`)
        } else {
          console.error('Unknown Error:\n', e);
        }
      });
    }));
  }
}