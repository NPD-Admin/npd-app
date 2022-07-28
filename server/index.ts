import { NPDBot } from './src/NPDBot';
import { NPDServer } from './src/NPDServer';

const botInstance = new NPDBot();
botInstance.login(process.env.BOT_TOKEN);
NPDServer.start(botInstance);