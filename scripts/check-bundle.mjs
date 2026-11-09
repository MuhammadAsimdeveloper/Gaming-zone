import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const CHUNK_LIMIT_KB = Number(args.get('chunk-kb') ?? 600);
const INITIAL_LIMIT_KB = Number(args.get('initial-kb') ?? 170);

const failures = [];
const fail = (message) => failures.push(message);

const games = JSON.parse(readFileSync('src/data/games.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');

const initialFiles = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)].map((match) => match[1]),
  ),
];
const initialJs = initialFiles.filter((file) => file.endsWith('.js'));

const measure = (file) => {
  const bytes = readFileSync(`dist/assets/${file}`);
  return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
};

if (initialJs.length === 0) fail('dist/index.html references no JavaScript entry');
if (initialFiles.every((file) => !file.endsWith('.css'))) fail('dist/index.html references no stylesheet');

const initialBytes = initialFiles.reduce(
  (total, file) => {
    const { raw, gzip } = measure(file);
    return { raw: total.raw + raw, gzip: total.gzip + gzip };
  },
  { raw: 0, gzip: 0 },
);
const initialKb = initialBytes.gzip / 1024;
if (initialKb > INITIAL_LIMIT_KB) {
  fail(`initial assets gzip to ${initialKb.toFixed(1)} kB (budget ${INITIAL_LIMIT_KB} kB)`);
}

for (const file of initialJs) {
  if (file.includes('three.module')) fail(`three.js is in the initial bundle (${file})`);
  if (file.includes('Game-')) fail(`a game chunk is in the initial bundle (${file})`);
}

const gameChunks = assets.filter((file) => file.endsWith('.js') && file.includes('Game-'));
if (gameChunks.length !== games.length) {
  fail(`expected ${games.length} lazy game chunks, found ${gameChunks.length}`);
}

const threeChunks = assets.filter((file) => file.startsWith('three.module'));
if (threeChunks.length !== 1) fail(`expected one shared three.module chunk, found ${threeChunks.length}`);
if (threeChunks.some((file) => initialFiles.includes(file))) {
  fail('three.module is preloaded by the entry document');
}

const sizes = assets
  .filter((file) => file.endsWith('.js'))
  .map(measure)
  .sort((a, b) => b.raw - a.raw);

for (const { file, raw } of sizes) {
  const kb = raw / 1024;
  if (kb > CHUNK_LIMIT_KB) fail(`${file} is ${kb.toFixed(1)} kB (budget ${CHUNK_LIMIT_KB} kB)`);
}

const three = sizes.find(({ file }) => file.startsWith('three.module'));
console.log(
  `bundle: entry ${initialKb.toFixed(1)} kB gzip, ${initialFiles.length} initial assets, ` +
    `${gameChunks.length} lazy game chunks, three.js ${three ? `${(three.raw / 1024).toFixed(1)} kB raw` : 'missing'}`,
);

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}

console.log('bundle budgets met');
