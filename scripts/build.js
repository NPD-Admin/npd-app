import { concurrently } from 'concurrently';
import { resolve } from 'path';

(async () => {
  const installResults = await concurrently(['server', 'main', 'widgets'].map(d => ({
    command: 'npm i',
    cwd: resolve(process.cwd(), d)
  }))).result;
  await concurrently(installResults.map(d => ({
    command: 'npm run build',
    cwd: d.command.cwd
  }))).result;
})();