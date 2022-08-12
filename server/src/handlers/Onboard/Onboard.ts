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
import { BotEvent } from "../../types/events/EventType";
import { TimerEvent } from "../../types/events/TimerEvent";
import { DiscordUtils } from "../../utils/DiscordUtils";
import { ErrorGenerator } from "../../utils/ErrorGenerator";
import { GoogleClient } from "../../utils/Google/GoogleClient";
import { Mailer } from "../../utils/Mailer";
import { MailerLite } from "../../utils/MailerLite";
import {
  Collection,
  MongoConnection,
  WithId
} from "../../utils/MongoConnection";
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

type OnboardingAsset = {
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

export class Onboard {
  private static botInstance: NPDBot;
  private static assetCollection: Collection;
  private static memberCollection: Collection;

  static init(botInstance: NPDBot): void {
    if (Onboard.botInstance) return;
    Onboard.botInstance = botInstance;
    Onboard.assetCollection = MongoConnection.getCollection('assets');
    Onboard.memberCollection = MongoConnection.getCollection('members');
  }

  static async doOnboarding(payload: MemberResolvable): Promise<void | Error[]> {
    const onboard = new Onboard(Onboard.botInstance, payload);
    const inited = await onboard.inited;
    if (inited && inited instanceof Error) return [inited];

    if (!onboard.memberRecord) return [ErrorGenerator.generate({ message: 'No MemberRecord found.' })];
    if (!onboard.currentAsset) return [ErrorGenerator.generate({ message: 'No current OnboardingAsset found.' })];
    if (!onboard.config) return [ErrorGenerator.generate({ message: 'No OnboardingConfig found for this guild.' })];

    const handlerResult = await onboard.handleInteraction();
    if (handlerResult.length) return await onboard.handleInteractionErrors(handlerResult);

    if (!onboard.guildMember) return [ErrorGenerator.generate({ message: 'GuildMember not found.' })];
    await onboard.updateGuildMember();

    const nextAsset = onboard.populateNextAsset();
    if (nextAsset instanceof Error) return [nextAsset];
    
    const assetLoadingError =
      (nextAsset === onboard.currentAsset && 'Uncaught error updating member record.')
      || (nextAsset.modalJson && !('showModal' in onboard.payload) && 'The next asset contains a modal, but Discord does not support showing modals for this event.');

    if (assetLoadingError && onboard.payload instanceof ModalSubmitInteraction)
      await onboard.payload.reply({
        ...retryMessage,
        ephemeral: (onboard.payload as Interaction).channel?.type !== 'DM',
        content: retryMessage.content?.replace('$$', `\n\n${assetLoadingError}\n\n`)
      });
    else if (nextAsset.msgJson)
      await onboard.sendMessageStep(nextAsset);
    else if (nextAsset.modalJson && onboard.payload instanceof Interaction)
      await (onboard.payload as ButtonInteraction).showModal(nextAsset.modalJson);
    else return [ErrorGenerator.generate({ e: nextAsset, message: 'We got lost somewhere:' })];
  }

  private inited: Promise<Error | true>;
  private memberRecord?: WithId<MemberRecord>;
  private guildMember?: GuildMember;
  private config?: WithId<OnboardingConfig>;
  private assets?: WithId<OnboardingAsset>[];
  private currentAsset?: WithId<OnboardingAsset>;

  constructor(private instance: NPDBot, private payload: MemberResolvable) {
    this.inited = this.init();
  }

  async init(): Promise<true | Error> {
    const memberRecord = this.memberRecord = await this.getMemberRecord()
    const guildMember = await this.loadGuildMemberData();
    if (guildMember instanceof Error) return guildMember;
    this.guildMember = guildMember;

    this.config = await Onboard.assetCollection.findOne({
      type: 'OnboardingConfig',
      guildId: guildMember.guild.id
    }) as WithId<OnboardingConfig>;
    if (!this.config) return ErrorGenerator.generate({ e: guildMember.guild.id, message: 'No OnboardingConfig found for this guild:' });

    this.assets = await Onboard.assetCollection.find({
      type: 'OnboardingAsset',
      guildId: this.config.guildId
    }).sort({ order: 1 }).toArray() as WithId<OnboardingAsset>[];
    if (!this.assets.length) return ErrorGenerator.generate({ e: this.config.guildId, message: 'No OnboardingAssets found for this guild:' });

    this.currentAsset = this.assets.find(asset => asset.fieldMapping.some(c => !Object.keys(memberRecord).includes(c) || !memberRecord[c]));
    if (!this.currentAsset) return ErrorGenerator.generate({ e: memberRecord, message: 'Could not determine current OnboardingAsset for GuildMember:' });

    return true;
  }

  private async getMemberRecord(edit: boolean = false): Promise<WithId<MemberRecord>> {
    const memberPayload = { discordUserId: this.payload.user.id, edit: { $exists: edit } } as WithId<MemberRecord>;
    delete memberPayload.edit;
    const foundMember = await Onboard.memberCollection.findOne(memberPayload) as WithId<MemberRecord>;

    if (!foundMember) memberPayload._id = (await Onboard.memberCollection.insertOne(memberPayload)).insertedId;
    return (foundMember ?? memberPayload) as WithId<MemberRecord>;
  }

  private async loadGuildMemberData(): Promise<GuildMember | Error> {
    if (!Onboard.botInstance) return new Error('Onboarding has not been initialized.');

    const guildMember = await this.findGuildMember();
    const memberRecord = this.memberRecord!;

    if (guildMember && guildMember instanceof GuildMember) {
      memberRecord.guildId = guildMember.guild.id;
      memberRecord.guildMemberId = guildMember.id;
      this.payload.member = guildMember;
      return guildMember;
    } else if (guildMember instanceof Error) return new Error(`Error finding Guild / Member information for onboarding:\n${guildMember.message}`);
      else return new Error(`Unknown error finding Guild / Member information for onboarding:\n${guildMember}`);
  }

  private async findGuildMember(): Promise<GuildMember | Error> {
    if (!Onboard.botInstance) return new Error('Onboarding has not been initialized.');
    let guildMember;
    if (this.payload.member && this.payload.member instanceof GuildMember) guildMember = this.payload.member;
    else if (this.payload.guild && this.payload.guild instanceof Guild) guildMember = this.payload.guild.members.resolve(this.payload.user) as GuildMember;
    else guildMember = await DiscordUtils.findGuildMember(Onboard.botInstance.client, this.payload.user) as GuildMember;
    return guildMember;
  }

  private async handleInteraction(): Promise<Error[]> {
    const memberRecord = this.memberRecord!, currentAsset = this.currentAsset!, config = this.config!;
    if (!(this.payload instanceof ButtonInteraction || this.payload instanceof ModalSubmitInteraction || this.payload instanceof SelectMenuInteraction)) return Promise.resolve([]);
    const errors = [] as Error[];

    const data = this.extractInteractionValues();
    const customId = this.payload.customId.split('.').filter((v, i, a) => (((isNaN(Number(a[a.length-1])) && 3) || 2) === a.length) || a.length === 2 || i !== 1).join('.');

    if (customId === 'OnboardingAsset.0000.started') {

      memberRecord.started = Date.now();
      if (this.payload.message?.channel.type !== 'GUILD_TEXT')
      this.payload.message?.delete();

    } else if (customId === 'OnboardingAsset.0000.leave') {

      this.payload.member.kick('Requested');

    } else if (customId === 'OnboardingAsset.0001') {

      if (Onboard.validateNickname(data.nickname)) {
        memberRecord.nickname = data.nickname;
        await this.payload.member.setNickname(data.nickname).catch(e => {
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
          memberRecord.legalAddress = address?.address || `Declined: ${Date.now()}`;
        }
      } else memberRecord.legalName = memberRecord.legalAddress = `Declined: ${Date.now()}`;

      if (data.email) data.email = data.email.trim();
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
        errors.push(new Error(`Invalid email address: ${`"${data.email}}"` || '*empty*'}`));

    } else if (customId === 'OnboardingAsset.0002.emailVerified') {

      memberRecord.emailVerified = true;
      this.payload.message?.delete();

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

      console.log((this.payload as SelectMenuInteraction).values);

    } else if (customId === 'OnboardingAsset.0004.contactVerified') {

      memberRecord.contactVerified = Date.now();
      this.payload.message?.delete();

    } else if (customId === 'OnboardingAsset.0005') {

      if (data.feedback) memberRecord.feedback = data.feedback;
      else memberRecord.feedback = `Declined: ${Date.now()}`;
      memberRecord.completed = Date.now();

    } else if (customId === 'OnboardingAsset.0006.view') {

      const msg = await Onboard.applyTemplate(memberRecord);
      await this.payload.reply(msg);

    } else if (customId === 'OnboardingAsset.RETRY') {

      if (!this.payload.ephemeral)
        await this.payload.message?.delete().catch(console.error);
      return [];

    }
    else return [new Error(`Interaction Custom ID not handled: ${this.payload.customId}: ${customId}`)];

    await Onboard.memberCollection.updateOne({ _id: memberRecord._id }, { $set: memberRecord });

    return errors;
  }

  private extractInteractionValues(): Omit<MemberRecord, 'social'> & { social: string } {
    if (!(this.payload instanceof ModalSubmitInteraction)) return {} as Omit<MemberRecord, 'social'> & { social: string };

    const currentAsset = this.currentAsset!;
    const payload = this.payload as ModalSubmitInteraction;

    const data = {} as Omit<MemberRecord, 'social'> & { social: string };
    currentAsset.fieldMapping.forEach(key => data[key] = payload.fields.getTextInputValue(`${payload.customId}.${key}`) as never);

    return data;
  }

  private async handleInteractionErrors(errors: Error[]): Promise<Error[]> {
    const errorMessage = {
      ...retryMessage,
      content: retryMessage.content?.replace('$$', `\n\n${errors.map(e => e.message).join('\n')}\n\n`)
    } as InteractionReplyOptions;

    if (this.payload instanceof Interaction && this.payload.isRepliable())
      await this.payload.reply({ ...errorMessage, ephemeral: this.payload.channel?.type !== 'DM' });
    else
      await this.payload.user.send(errorMessage as MessagePayload);
    
    return errors;
  }

  private async updateGuildMember(): Promise<void> {
    const guildMember = this.guildMember!, config = this.config!, memberRecord = this.memberRecord!;
    if (memberRecord.completed && guildMember.roles.resolve(config.guestRoleId)) {
      await guildMember.roles.add(config.completedRoleId);
      await guildMember.roles.remove(config.guestRoleId);
    }

    if (memberRecord.nickname && memberRecord.nickname !== guildMember.nickname) await guildMember.setNickname(memberRecord.nickname)
      .catch(e => {
      if ((e as DiscordAPIError).code === 50013) {
        console.error('No permission to edit GuildMember nickname.  Is this the Guild admin?');
      } else throw e;
    })
  }

  private populateNextAsset(): WithId<OnboardingAsset> | Error {
    const memberRecord = this.memberRecord!, assets = this.assets!,
      asset = assets.find(asset => asset.fieldMapping.some(c => !Object.keys(memberRecord).includes(c) || !memberRecord[c]));
    if (asset?.modalJson) this.populateFields(asset);
    return asset || ErrorGenerator.generate({ e: memberRecord, message: 'Could not determine next OnboardingAsset for GuildMember:' });
  }

  private populateFields(nextAsset: WithId<OnboardingAsset>) {
    const memberRecord = this.memberRecord!;
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
    nextAsset: WithId<OnboardingAsset>
  ): Promise<void> {
    const config = this.config!;
    Onboard.fillVariables(nextAsset, this.payload, config, true);
    const msg = DiscordUtils.createMessagePayload(this.payload.user, nextAsset.msgJson!);

    if (this.payload instanceof Interaction && this.payload.isRepliable()) {
      if (this.payload.channel?.type === 'GUILD_TEXT') {
        await this.payload.user.send(msg);
        await this.payload.reply({ ephemeral: true, content: 'Check your private messages.' });
      } else if (!this.payload.replied) {
        await this.payload.reply(msg);
      }
    } else if (this.payload instanceof Message) {
      await this.payload.user.send(msg);
      if (this.payload.channel.type !== 'DM')
        await this.payload.reply({ content: 'Check your private messages.' });
    } else if (this.payload instanceof GuildMember) {
      await this.payload.user.send(msg);
    }
  }

  private static validateNickname(nickname: string): boolean {
    return !!nickname;
  }

  private static fillVariables(asset: OnboardingAsset, payload: MemberResolvable, config: OnboardingConfig, preresolve: boolean): void {
    function roleResolver(roleId: Snowflake) {
      return Onboard.botInstance.client.guilds.resolve(config.guildId)?.roles.resolve(roleId);
    }
    const mapping = (preresolve && ((substring: string, ...hits: any[]) => {
      if ((hits[0] as string).toLowerCase().includes('roleid')) {
        return `\`@${roleResolver(config[hits[0] as keyof OnboardingConfig])?.name}\``;
      }
      return config[hits[0] as keyof OnboardingConfig];
    })) || ((substring: string, ...hits: any[]) => `<@&${config[hits[0] as keyof OnboardingConfig]}>`);
    
    asset.msgJson!.embeds[0].description = asset.msgJson!.embeds[0].description!
      .replace(/\$\$(\w+)\$\$/g, mapping);
  }

  private static async applyTemplate(memberRecord: WithId<MemberRecord>): Promise<InteractionReplyOptions> {
    const template = await Onboard.assetCollection.findOne({ type: 'OnboardingViewTemplate', guildId: memberRecord.guildId }) as WithId<MessageAsset>;
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

  static async postApplicationList(command: CommandInteraction): Promise<void> {
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
    const memberRecordsCount = await Onboard.memberCollection.count({ guildId: command.guildId });
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

  static async postFirstAsset(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId))
      return command.reply({ ephemeral: true, content: 'You do not have permission to post onboarding applications.' });

    await command.deferReply();
    const channel = (command.options.getChannel('channel') ?? command.channel) as TextChannel;
    const asset = await Onboard.assetCollection.findOne({ type: 'OnboardingAsset', order: 0 }) as WithId<OnboardingAsset>;
    Onboard.fillVariables(asset, command, config, false);
    await channel.send(DiscordUtils.createMessagePayload(channel, asset.msgJson!));
    await command.deleteReply()
  }

  static async deleteApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId))
      return command.reply({ ephemeral: true, content: 'You do not have permission to delete onboarding applications.' });

    const result = await Onboard.memberCollection.deleteMany({ discordUserId: command.options.getUser('user', true).id });
    await command.reply({ ephemeral: true, content: `Deleted (${result.deletedCount}) applications for user.`});
  }

  static async editApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    const user = command.options.getUser('user') ?? command.user;

    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId) && command.member!.user !== user)
      return command.reply({ ephemeral: true, content: 'You do not have permission to edit others\' onboarding applications.'});

    const editRecord = await new Onboard(Onboard.botInstance, command).getMemberRecord(true);
    await Onboard.doOnboarding(command);
  }

  static async postApplication(command: CommandInteraction): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: command.guild!.id }) as WithId<OnboardingConfig>;
    const user = command.options.getUser('user') ?? command.user;
    
    if (!(command.member as GuildMember).roles.resolve(config.manageRoleId) && command.member!.user !== user)
      return command.reply({ ephemeral: true, content: 'You do not have permission to view others\' onboarding applications.' });

    const application = await Onboard.memberCollection.findOne({ discordUserId: user.id }) as WithId<MemberRecord>;
    if (!application) return await command.reply({ ephemeral: true, content: `No application exists for User: <@${user.id}>`});
    if (!application.guildId) application.guildId = command.guildId!;

    const msg = await Onboard.applyTemplate(application);
    await command.reply({ ...msg, ephemeral: !command.options.getBoolean('public') });
  }
  
  static async assignGuestRole(member: GuildMember): Promise<void> {
    const config = await Onboard.assetCollection.findOne({ type: 'OnboardingConfig', guildId: member.guild!.id }) as WithId<OnboardingConfig>;
    const alreadyJoined = await Onboard.memberCollection.findOne({ discordUserId: member.user.id });
    if (!alreadyJoined) await member.roles.add(config.guestRoleId);
    else await this.botInstance.getConfig(member.guild.id)?.logChannel?.send(`<@${member.id} rejoined the server.`);
  }

  static async getPromptTimes(): Promise<Map<Snowflake, string>> {
    const configs = await Onboard.assetCollection.find({ type: 'OnboardingConfig' }).toArray() as WithId<OnboardingConfig>[];
    const ret = new Map<Snowflake, string>();
    configs.forEach(config => ret.set(config.guildId, config.promptTime));
    return ret;
  }

  static async promptIncompleteUsers(evt: TimerEvent | CommandInteraction, member?: GuildMember | null): Promise<void> {
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
      .replace(/\$\$(\w+?)\$\$/g, (substring: string, ...hits: any[]) => `<#${reminderMsg[hits[0] as keyof OnboardingReminderAsset]}>`);

    if (member instanceof GuildMember) {
      console.log(`Prompting one user: ${member.nickname || member.user.username}`);
      Onboard.fillVariables(asset, member, config, true);
      const channel = await member.createDM();
      await channel.send(DiscordUtils.createMessagePayload(channel, asset.msgJson!)).catch(console.error);
      await channel.send(DiscordUtils.createMessagePayload(member, reminderMsg.msgJson as MessagePayload['data'])).catch(e => {
        if (e instanceof DiscordAPIError) {
          console.error(`Failed to send pruning reminder to: ${member.user.username}\n`)
        } else {
          console.error('Unknown Error:\n', e);
        }
      });
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
      Onboard.fillVariables(asset, m, config, true);
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