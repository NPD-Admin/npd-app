import { concurrently } from 'concurrently';
import { readdirSync } from 'fs';
import { resolve } from 'path';

const files = readdirSync(process.cwd(), { withFileTypes: true });
const directories = files.filter(f => f.isDirectory() && f.name !== 'node_modules');
console.log('Found Widgets:\n', directories.map(d => `--${d.name}`).join('\n'));

(async () => {
  const installResult = await concurrently(directories.map(d => ({
    command: 'npm i',
    cwd: resolve(process.cwd(), d.name)
  }))).result;
  const buildResult = await concurrently(installResult.map(d => ({
    command: 'npm run build',
    cwd: d.command.cwd
  }))).result;
  await concurrently(buildResult.map(d => ({
    command: 'webpack',
    cwd: d.command.cwd
  }))).result;
  console.log(`Webpack of (${directories.length}) widgets complete.`)
})();