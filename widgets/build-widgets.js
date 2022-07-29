import { concurrently } from 'concurrently';
import { readdirSync } from 'fs';
import { resolve } from 'path';

const prune = process.argv[2] === 'prune';

const files = readdirSync(process.cwd(), { withFileTypes: true });
const directories = files.filter(f => f.isDirectory() && f.name !== 'node_modules');
console.log(`Found (${directories.length}) Widgets:\n`, directories.map(d => ` • ${d.name}`).join('\n'));

const sub = (e) => {
  e.forEach(console.log);
  e.forEach(i => i.command.stdout.subscribe(console.log));
  e.forEach(i => i.command.stderr.subscribe(console.error));
};

(async () => {
  console.log('Installing widgets...');
  const installResult = await concurrently(directories.map(d => ({
    command: 'npm ci --include=dev',
    cwd: resolve(process.cwd(), d.name)
  }))).result.catch(sub);
  if (!installResult) return console.error('Widget packing failed: Installation');
  console.log('Installation complete.  Building widget code...');
  const buildResult = await concurrently(installResult.map(d => ({
    command: 'npm run build',
    cwd: d.command.cwd
  }))).result.catch(sub);
  if (!buildResult) return console.error('Widget packing failed: Building');
  console.log('Builds complete, packing bundles...');
  const packingResult = await concurrently(buildResult.map(d => ({
    command: 'npm run pack',
    cwd: d.command.cwd
  }))).result.catch(sub);
  if (!packingResult) return console.error('Widget packing failed: Packing');
  console.log('Packing complete, pruning dependencies...');
  if (!prune) return console.log(
    'Pruning flag not set.  Skipping pruning.\n',
    `Webpack of (${directories.length}) widgets complete.`
  );
  const pruneResult = await concurrently(packingResult.map(d => ({
    command: 'npm prune',
    cwd: d.command.cwd
  }))).result.catch(sub);
  if (!pruneResult) return console.error('Widget packing failed: Pruning');
  console.log('Pruning complete.');
  console.log(`Webpack of (${directories.length}) widgets complete.`)
})();