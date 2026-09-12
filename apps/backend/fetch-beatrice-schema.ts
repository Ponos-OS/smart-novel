import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCHEMA_PATH = join(
  __dirname,
  'src/shared/beatrice/schema.graphql',
);

function resolveBeatriceVersion(): string {
  if (process.env.BEATRICE_VERSION) {
    return process.env.BEATRICE_VERSION;
  }

  const rootEnvPath = join(__dirname, '../../.env');
  const rootEnv = readFileSync(rootEnvPath, 'utf-8');
  const match = rootEnv.match(/^BEATRICE_VERSION=(.+)$/m);

  if (!match) {
    throw new Error(
      `BEATRICE_VERSION is not set and could not be found in ${rootEnvPath}`,
    );
  }

  return match[1].trim();
}

async function fetchBeatriceSchema() {
  if (existsSync(SCHEMA_PATH)) {
    console.log(
      `✅ Beatrice schema already present at ${SCHEMA_PATH}, skipping download`,
    );
    return;
  }

  const version = resolveBeatriceVersion();
  const url = `https://kasir-barati.github.io/smart-novel-beatrice/v${version}/schema.graphql`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Beatrice schema v${version} from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const sdl = await response.text();

  writeFileSync(SCHEMA_PATH, sdl);
  console.log(
    `✅ Beatrice schema v${version} written to ${SCHEMA_PATH}`,
  );
}

fetchBeatriceSchema();
