import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OPENAPI_PATH = join(
  __dirname,
  'src/shared/fithara/openapi.json',
);

function resolveFitharaVersion(): string {
  if (process.env.FITHARA_VERSION) {
    return process.env.FITHARA_VERSION;
  }

  const rootEnvPath = join(__dirname, '../../.env');
  const rootEnv = readFileSync(rootEnvPath, 'utf-8');
  const match = rootEnv.match(/^FITHARA_VERSION=(.+)$/m);

  if (!match) {
    throw new Error(
      `FITHARA_VERSION is not set and could not be found in ${rootEnvPath}`,
    );
  }

  return match[1].trim();
}

function readDownloadedVersion(): string | null {
  if (!existsSync(OPENAPI_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(OPENAPI_PATH, 'utf-8')).info
      .version;
  } catch {
    return null;
  }
}

async function fetchFitharaOpenApi() {
  const version = resolveFitharaVersion();

  if (readDownloadedVersion() === version) {
    console.log(
      `✅ Fithara OpenAPI spec v${version} already present at ${OPENAPI_PATH}, skipping download`,
    );
    return;
  }

  const url = `https://ponos-os.github.io/fithara/v${version}/openapi.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Fithara OpenAPI spec v${version} from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const spec = await response.text();

  writeFileSync(OPENAPI_PATH, spec);
  console.log(
    `✅ Fithara OpenAPI spec v${version} written to ${OPENAPI_PATH}`,
  );
}

fetchFitharaOpenApi();
