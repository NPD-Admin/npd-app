import { concurrently } from 'concurrently';
import { resolve } from 'path';

(async () => {
  console.log('Beginning npm installs...');
  const installResults = await concurrently(['server', 'main', 'widgets'].map(d => ({
    command: 'npm i',
    cwd: resolve(process.cwd(), d)
  }))).result.catch(console.error);
  console.log('Installs complete, beginning npm builds...');
  await concurrently(installResults.map(d => ({
    command: 'npm run build',
    cwd: d.command.cwd
  }))).result.catch(console.error);
  console.log('Builds complete.');
})();