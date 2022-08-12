import { ApplicationCommandData, ApplicationCommandDataResolvable, Client, DiscordAPIError, Guild, Snowflake, TextChannel } from 'discord.js';
import { readdirSync, Dirent } from 'fs';
import { join, normalize } from 'path';
import { createHash } from 'crypto';

import { BotConfig, NPDBot } from "../NPDBot";
import { BaseHandler, HandlerConfig, IHandler, TimerConfig } from '../types/IHandler';
import { MongoConnection, WithId } from '../utils/MongoConnection';
import { AssetLoader } from '../utils/AssetLoader';
import { GoogleClient } from '../utils/Google/GoogleClient';
import { EventType, PresenceChange, Reaction } from '../types/EventTypes';
import { ActivityTypes } from 'discord.js/typings/enums';

type CommandCache = {
  guildIds: Snowflake[];
  allCommands: string;
  checksum: string;
  commandStamps: Array<{
    command: string,
    config: ApplicationCommandData | HandlerConfig | TimerConfig,
    hash: string
  }>;
};

type CacheUpdates = {
  guilds: Guild[];
  oldCacheObj: CommandCache;
  newCacheObj: CommandCache;
}

type BaseHandlerConstructor = new (instance?: NPDBot) => BaseHandler;

export default class Setup {

  static runSetup(botInstance: NPDBot, client: Client) {
    console.log(`Beginning NPD Bot Setup...`);
    new Setup(botInstance, client).registerEventListeners();
  }

  constructor(private botInstance: NPDBot, private client: Client) {}

  private registerEventListeners() {
    this.client.on('ready', () => this.completeSetup());

    this.client.on('interactionCreate', interaction => this.botInstance.handle(interaction));
    this.client.on('messageCreate', message => this.botInstance.handle(message));
    this.client.on('guildMemberAdd', member => this.botInstance.handle(member));
    this.client.on<'presenceUpdate'>('presenceUpdate', (o, n) => this.botInstance.handle(new PresenceChange(o, n)));
    this.client.on<'messageReactionAdd'>('messageReactionAdd', (r, u) => this.botInstance.handle(new Reaction(r, u)));
    this.client.on<'messageReactionRemove'>('messageReactionRemove', (r, u) => this.botInstance.handle(new Reaction(r, u)));
  }

  private async completeSetup(): Promise<void> {
    if (this.botInstance.isActive) this.botInstance.client.user?.setActivity('with myself.  Under active development, responses may be unpredictable.');
    else this.botInstance.client.user?.setActivity({ name: 'for commands...', type: ActivityTypes.LISTENING });

    await this.loadDefaultAssets();
    await this.loadConfigs();
    await this.loadEventHandlers();
    console.log(`...NPD Bot Setup Completed.\n\nReady...\n\n\n`);
  }

  private async loadDefaultAssets(): Promise<void> {
    console.log(`  Loading Default Assets...`);
    console.log(`    Loading Fresh Assets...`);
    const loadedAssets = await this.loadAssets('../../assets') as [string, string[]][];
    console.log(`    ...done.\n`);

    console.log(`    Compiling Fresh Asset List...`)
    const assetList = {} as { [key: string]: string[] };
    loadedAssets.forEach(asset => (assetList[asset[0]] = [...(assetList[asset[0]] || []), ...asset[1]]));
    console.log(Object.keys(assetList).map(k => ({ [k]: assetList[k].length })));
    console.log(`    ...done.\n`);

    console.log(`    Deleting Stale Assets...`);
    const deleteAssets = async (collectionName: string) =>
      await AssetLoader.deleteStaleAssets({ collectionName, freshAssetIdentifiers: assetList[collectionName] });
    const results = await Promise.all(Object.keys(assetList).map(deleteAssets));
    console.log(results);
    console.log(`    ...done.\n`);
    console.log(`  ...loaded (${Object.keys(assetList).reduce((p, c) => assetList[c].length + p, 0)}) assets.\n`);
  }

  private async loadEventHandlers(): Promise<void> {
    console.log(`  Loading Event Handlers...`);

    console.log(`    Reading Handler Files...`);
    this.botInstance.handlers = await this.loadHandlers('../handlers') as IHandler[];
    console.log(`    ...done.\n`);

    console.log(`    Initializing IHandlers...`);
    await Promise.all(this.botInstance.handlers.map(handler => handler.init && handler.init(this.botInstance)));
    console.log(`    ...done.\n`);

    const cmdHandlers = this.botInstance.handlers.filter(h => h.type === EventType.COMMAND);

    console.log(`  (${cmdHandlers.length}) Commands Loaded.`);
    console.log(`  (${this.botInstance.handlers.length}) Handlers Total.`);
    console.log(`  ...done.\n`);

    await this.registerCommands(cmdHandlers);
  }

  private async loadAssets(dir: string): Promise<(Error | [string, string[]])[]> {
    const files = this.getFileTree(dir, ['json']);
    return (await Promise.all(files.map(f => AssetLoader.loadAssets(join(__dirname, dir, f))))).filter(i => i);
  }

  private async loadHandlers(dir: string): Promise<IHandler[]> {
    const files = this.getFileTree(dir, ['ts', 'js']);

    return (await Promise.all(files.map(async f => {
      const fileExports = require(join(__dirname, dir, f));
      const fileClasses = Object.values(fileExports).filter(e => typeof e === 'function') as BaseHandlerConstructor[];
      const handlerClasses = fileClasses.filter(c => c.prototype instanceof BaseHandler);
      const fileInstances = handlerClasses.map(fileClass =>
        console.log(fileClass) as unknown as false || new fileClass(this.botInstance) as IHandler
      );
      return fileInstances;
    }))).flat().filter(i => i);
  }

  private getFileTree(dir: string, extensions: string[]): string[] {
    const path = normalize(join(__dirname, dir));
    const files: Dirent[] = readdirSync(path, { withFileTypes: true });

    return files.map(f => {
      if (f.isDirectory()) return this.getFileTree(join(dir, f.name), extensions).map(file => join(dir, f.name, file));
      console.log(join(path, f.name));
      if (extensions.some(extension => f.name.endsWith(`.${extension}`))) return f.name;
      else return '';
    }).flat().filter(i => i);
  }

  private async loadConfigs(): Promise<void> {
    console.log(`  Resolving Guild configs...`);

    const config = await MongoConnection.getCollection('assets').find({ type: 'BotConfig' }).toArray() as WithId<BotConfig>[];
    this.botInstance.configs.push(...config);
    
    console.log(`    Resolving (${this.botInstance.configs.length}) Guild configs...`);

    await Promise.all(this.botInstance.configs.map(async config => {
      config.guild = this.client.guilds.resolve(config.guildId);
      config.logChannel = this.client.channels.resolve(config.logChannelId) as TextChannel;
      await config.logChannel.send(`<@${this.client.user?.id}> connected...`)
    }));

    console.log(`  ...done.\n`);
  }

  private async registerCommands(commandHandlers: IHandler[]) {
    console.log(`  Updating (${commandHandlers.length}) command registrations...`);

    const guilds = await this.getGuilds();
    const newCacheObj = this.generateCacheRecord(guilds, commandHandlers);

    const cacheCollection = MongoConnection.getCollection('cache');
    const oldCacheObj = await cacheCollection.findOne({ type: 'CommandCache' }) as WithId<CommandCache>;
    if (oldCacheObj)
      console.log([
        `Loaded old command config cache record with (${oldCacheObj.commandStamps.length}) commands.`,
        `${oldCacheObj.commandStamps.map(c => c.config.name).join(', ')}`,
        `checksum: ${oldCacheObj.checksum}`
      ].join('\n'));
    else console.log(`No old command config cache found.`);

    await this.processCommandCacheUpdates({ guilds, oldCacheObj, newCacheObj });

    await cacheCollection.updateOne({ type: 'CommandCache' }, { $set: newCacheObj }, { upsert: true });

    console.log(`  ...command registrations up to date.\n`);
  }
  
  private async getGuilds(): Promise<Guild[]> {
    const guilds = await Promise.all((await this.client.guilds.fetch()).map(guild => guild.fetch()));
    const guildCountText = `Bot registered in (${guilds.length}) guilds.\n`;
    const guildStatusText = `${guildCountText}${new Array(guildCountText.length).join('=')}`;
    console.log(guildStatusText);
    console.log(guilds.map(g => `${g.name} (${g.id})`).join('\n'))
    
    return guilds;
  }

  private generateCacheRecord(guilds: Guild[], commandHandlers: IHandler[]): CommandCache {
    const encoded = Buffer.from(commandHandlers.map(c => JSON.stringify(c.config)).join()).toString('base64');
    const newCacheObj: CommandCache = {
      guildIds: guilds.map(g => g.id),
      allCommands: encoded,
      checksum: createHash('md5').update(encoded).digest('hex'),
      commandStamps: commandHandlers.map(c => ({
        command: c.config.name,
        config: c.config,
        hash: Buffer.from(JSON.stringify(c.config)).toString('base64')
      }))
    };
    console.log([
      `Created new command config cache record with (${newCacheObj.commandStamps.length}) commands.`,
      `${newCacheObj.commandStamps.map(c => c.config.name).join(', ')}`,
      `checksum: ${newCacheObj.checksum}`
    ].join('\n'));

    return newCacheObj;
  }

  private async processCommandCacheUpdates({ guilds, oldCacheObj, newCacheObj }: CacheUpdates): Promise<void> {
    const newGuilds = guilds.filter(g => !oldCacheObj || !oldCacheObj.guildIds.includes(g.id));
    const oldGuilds = guilds.filter(g => !newGuilds.includes(g));

    if (!oldCacheObj || oldCacheObj.allCommands !== newCacheObj.allCommands || newGuilds.length) {
      if (newGuilds.length) {
        console.log(`    Registering all commands to (${newGuilds.length}) new guilds...`)
        await Promise.all(newGuilds.map(g => newCacheObj.commandStamps.map(c => g.commands.create(c.config as ApplicationCommandDataResolvable))).flat())
          .catch(this.handleCommandRegistrationErrors);
        console.log(`    ...all commands registered to new guilds.`);
      }

      if (!oldCacheObj || (oldCacheObj.allCommands !== newCacheObj.allCommands)) {
        const updateStamps = newCacheObj.commandStamps.filter(c => {
          const oldCommand = oldCacheObj && oldCacheObj.commandStamps.find(o => o.command === c.command);
          return !oldCommand || oldCommand.hash !== c.hash;
        });
        const deleteStamps = (oldCacheObj && oldCacheObj.commandStamps.filter(c => !newCacheObj.commandStamps.find(n => n.command === c.command))) || [];

        if (updateStamps.length && oldGuilds.length) {
          console.log(`    Found (${updateStamps.length}) command config changes, applying to existing guilds...`);
          await Promise.all(oldGuilds.map(g => updateStamps.map(c => g.commands.create(c.config as ApplicationCommandDataResolvable))).flat())
            .catch(this.handleCommandRegistrationErrors);
          console.log(`    ...command config changes applied to existing guilds.\n${updateStamps.map(c => c.config.name).join(', ')}`);
        }

        if (deleteStamps.length) {
          console.log(`    Found (${deleteStamps.length}) deleted commands, deleting from all guilds...`);
          await Promise.all(guilds.map(g => deleteStamps.map(c => g.commands.delete(c.config.name))))
            .catch(this.handleCommandRegistrationErrors);
          console.log(`    ...deleted removed commands.\n${deleteStamps.map(c => c.config.name).join(', ')}`);
        }
      }
    }
  }

  private handleCommandRegistrationErrors(e: any) {
    if (e instanceof DiscordAPIError) {
      console.error(`Some commands failed registration/deletion.  Some may still work.`);
      console.error(`${e.code}: ${e.message}`);
      console.error(JSON.stringify(e.requestData, null, 2));
      console.error(e.stack);
      return e;
    } else throw e;
  }
}