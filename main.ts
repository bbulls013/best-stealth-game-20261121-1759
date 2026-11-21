// Silent Ledger entrypoint: hands the static game to the grader.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the kit's buildDossier.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

for (const required of ['game/index.html', 'screenshots']) {
  if (!existsSync(join(repoRoot, required))) {
    throw new Error('Silent Ledger: missing required entry file ' + required);
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Silent Ledger: game, screenshots and dossier.json written to ' + outDir);
