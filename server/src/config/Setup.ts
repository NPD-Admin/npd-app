import { Client, DiscordAPIError, TextChannel } from 'discord.js';
import { readdirSync, Dirent } from 'fs';
import { join, normalize } from 'path';

import { BotConfig, NPDBot } from "../NPDBot";
import { IHandler } from '../types/IHandler';
import { MongoCollection, WithId } from '../utils/MongoCollection';
import { AssetLoader } from '../utils/AssetLoader';
import { GoogleClient } from '../utils/Google/GoogleClient';

function blueLog(args: TemplateStringsArray) { return ['\x1b[34m', ...args, '\x1b[0m'].join(''); }

export default class Setup {

  static runSetup(botInstance: NPDBot, client: Client) {
    console.log(blueLog`Beginning NPD Bot Setup...`);
    new Setup(botInstance, client).registerEventListeners();
  }

  constructor(private botInstance: NPDBot, private client: Client) {}

  private registerEventListeners() {
    this.client.on('ready', this.completeSetup());

    this.client.on('interactionCreate', interaction => this.botInstance.handleInteractions(interaction));
    this.client.on('messageCreate', message => this.botInstance.handleMessages(message));
    this.client.on('guildMemberAdd', member => this.botInstance.handleMember(member));
  }

  private completeSetup(): () => void {
    return async () => {
      await this.registerEventHandlers();
      await this.loadConfigs();
      await this.displayStartupMessage();
    }
  }

  private async registerEventHandlers(): Promise<void> {
    console.log(blueLog`  Loading Handlers & Assets...`);
    console.log(blueLog`    Loading Fresh Assets...`);
    const loadedAssets = await this.load('../assets') as [string, string[]][];
    console.log(blueLog`    ...done.\n`);

    console.log(blueLog`    Compiling Fresh Asset List...`)
    const assetList = {} as { [key: string]: string[] };
    loadedAssets.forEach(asset => (assetList[asset[0]] = [...(assetList[asset[0]] || []), ...asset[1]]));
    console.log(Object.keys(assetList).map(k => ({ [k]: assetList[k].length })));
    console.log(blueLog`    ...done.\n`);

    console.log(blueLog`    Deleting Stale Assets...`);
    const deleteAssets = async (collectionName: string) =>
      await AssetLoader.deleteStaleAssets({ collectionName, freshAssetIdentifiers: assetList[collectionName] });
    const results = await Promise.all(Object.keys(assetList).map(deleteAssets));
    console.log(results);
    console.log(blueLog`    ...done.\n`);

    console.log(blueLog`    Loading Handlers...`)
    const commandHandlers = await this.load('handlers/commands') as IHandler[];
    const interactionHandlers = await this.load('handlers/interactions') as IHandler[];
    const messageHandlers = await this.load('handlers/messages') as IHandler[];
    const miscHandlers = await this.load('handlers/misc') as IHandler[];
    const timerHandlers = await this.load('handlers/timers') as IHandler[];
    console.log(blueLog`    ...done.\n`)

    this.botInstance.handlers = [...this.botInstance.handlers, ...commandHandlers];
    this.botInstance.handlers = [...this.botInstance.handlers, ...interactionHandlers];
    this.botInstance.handlers = [...this.botInstance.handlers, ...messageHandlers];
    this.botInstance.handlers = [...this.botInstance.handlers, ...miscHandlers];
    this.botInstance.handlers = [...this.botInstance.handlers, ...timerHandlers];

    console.log(blueLog`    Initializing IHandlers...`);
    await Promise.all(this.botInstance.handlers.map(handler => handler.init && handler.init(this.botInstance)));
    console.log(blueLog`    ...done.\n`);

    console.log(`\x1b[32m  (${commandHandlers.length}) Commands     Loaded.`);
    console.log(`  (${interactionHandlers.length}) Interactions Loaded.`);
    console.log(`  (${messageHandlers.length}) Messages     Loaded.`);
    console.log(`  (${miscHandlers.length}) Misc         Loaded.`);
    console.log(`  (${timerHandlers.length}) Timers       Loaded.\x1b[0m\n`);
    console.log(`\x1b[35m  (${this.botInstance.handlers.length}) Handlers Total.\x1b[0m`);
    console.log(`\x1b[35m  (${Object.keys(assetList).reduce((p, c) => assetList[c].length + p, 0)}) Assets Loaded.\x1b[0m`);
    console.log(blueLog`  ...done.\n`);

    await this.registerCommands(commandHandlers);
  }

  private async registerCommands(commandHandlers: IHandler[]) {
    console.log(blueLog`  Registering commands to Guilds...`);
    const guilds = (await this.client.guilds.fetch())
      .map(guild => guild.fetch());
    const commandNames = commandHandlers.map(updateCommand => updateCommand.config.name)

    await Promise.all(guilds.map(async guild => {
      const commandMgr = (await guild).commands;

      const commands = (await commandMgr.fetch()).filter(existingCommand => !commandNames.includes(existingCommand.name));
      await Promise.all(commands.map(command => commandMgr.delete(command)));
      console.log(`Removed (${commands.size}) stale Guild Commands from: ${(await guild).name} (${(await guild).id})`);
      if (commands.size) console.log(commands.map(command => command.name).join(','));

      try {
        await Promise.all(commandHandlers.map(command => commandMgr.create(command.config)));
        console.log(`Added   (${commandHandlers.length}) Guild Commands to:   ${(await guild).name} (${(await guild).id})`);
        console.log(commandHandlers.map(command => command.config.name).join(', '));
      } catch (e) {
        if (e instanceof DiscordAPIError) {
          const apiError = e as DiscordAPIError;
          console.error(`Failed to create commands on Guild "${(await guild).name}" (${(await guild).id})`);
          console.error(`Other guilds and other bot functions may still work.  Error message:\n`)
          console.error(`"${apiError.message}"\n`);
        } else throw e;
      }
    }));
    console.log(blueLog`  ...done.\n`);
  }

  private async loadConfigs(): Promise<void> {
    const config = await (await MongoCollection.getCollection('assets')).collection.find({ type: 'BotConfig' }).toArray() as WithId<BotConfig>[];
    this.botInstance.configs.push(...config);
    console.log(blueLog`  Resolving Guild configs...`);
    console.log(`    Resolving (${this.botInstance.configs.length}) Guild configs...`);
    await Promise.all(this.botInstance.configs.map(async config => {
      config.guild = this.client.guilds.resolve(config.guildId);
      config.logChannel = this.client.channels.resolve(config.logChannelId) as TextChannel;
      await config.logChannel.send(`<@${this.client.user?.id}> connected...`)
    }));
    console.log(blueLog`  ...done.`);
  }

  private async load(dir: string, fromDir: string = '../handlers', extension: string = '.ts'): Promise<Error[] | IHandler[] | [string, string[]][]> {
    const srcDir = normalize(join(__dirname, '..', dir));
    const files: Dirent[] = readdirSync(srcDir, { withFileTypes: true });

    const handlers = files.map(file => {
      if (file.isDirectory()) return this.load(join(srcDir, file.name));
      console.log(`${srcDir}: ${file.name}`);
      if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
        const fileExports = require(join(srcDir, file.name)) as { [key: string]: any };
        const fileClasses = Object.values(fileExports);
        const fileInstances = fileClasses.map(fileClass => (new (fileClass as ObjectConstructor)() as IHandler));
        return fileInstances;
      } else if (file.name.endsWith('.json')) {
        return AssetLoader.loadAssets(join(srcDir, file.name));
      }
    }).flat().filter(i => i);

    const results = await Promise.all(handlers as Promise<IHandler | [string, string[]]>[]);
    const assets = results.filter(r => !(r as IHandler).config) as [string, string[]][];
    const resolvedHandlers = results.filter(r => (r as IHandler).config).flat() as IHandler[];

    if (assets.length) return assets;
    return resolvedHandlers;
  }

  private async displayStartupMessage(): Promise<void> {
    console.log(blueLog`...NPD Bot Setup Completed.`);
    await GoogleClient.login();

    const guilds = await this.client.guilds.fetch();
    const guildCount = `\nBot Logged into (${guilds.size}) Guilds:`;
  
    console.log(guildCount);
    console.log(new Array(guildCount.length).join('='));
    console.log(`${Array.from(guilds.map(guild => `(${guild.id}) ${guild.name}`)).join('\n')}\n`);
  
    console.log(blueLog`Ready...\n\n\n`);
  }
}