import { NPDBot } from './src/NPDBot';
import { NPDServer } from './src/NPDServer';
import { GoogleClient } from './src/utils/Google/GoogleClient';
import { MongoConnection } from './src/utils/MongoConnection';

(async function() {
  await MongoConnection.init();
  await GoogleClient.login();
  const botInstance = new NPDBot();
  botInstance.login(process.env.BOT_TOKEN);
  NPDServer.start(botInstance);
})();