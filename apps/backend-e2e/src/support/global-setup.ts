import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { extractZitadelConfigFromDocker } from './config.helper';
import { DockerFixture } from './docker.fixture';
import { Logger } from './logger';

declare global {
  var __TEARDOWN_MESSAGE__: string;
}
const workspaceRoot = resolve(__dirname, '../../../../');

export default async function setup() {
  Logger.section('Setting up Vitest globally');
  Logger.log('Cleaning up previous logs...');
  rmSync('local-setup/logs', { recursive: true, force: true });
  Logger.log('Starting Docker Compose services...');
  DockerFixture.startCompose(workspaceRoot, 'backend-e2e');
  Logger.log(
    'Extracting Zitadel credentials from the shared Docker volume onto the host EXACTLY ONCE, before any worker imports config.helper.ts and starts reading them.',
  );
  extractZitadelConfigFromDocker();
  Logger.section('Warming up Beatrice/Ollama');
  Logger.log('Sending a trivial LLM request to load the model...');
  DockerFixture.warmupBeatrice(workspaceRoot);
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';

  // Clean up logic here (e.g. stopping services, docker-compose, etc.).
  return async () => {
    mkdirSync(resolve(workspaceRoot, 'local-setup/logs'), {
      recursive: true,
    });
    DockerFixture.persistLogs(
      workspaceRoot,
      'init-postgres',
      'local-setup/logs/init-postgres.log',
    );
    DockerFixture.persistLogs(
      workspaceRoot,
      'zitadel',
      'local-setup/logs/zitadel.log',
    );
    DockerFixture.persistLogs(
      workspaceRoot,
      'setup-zitadel',
      'local-setup/logs/setup-zitadel.log',
    );
    DockerFixture.persistLogs(
      workspaceRoot,
      'backend-e2e',
      'local-setup/logs/backend.log',
    );
    DockerFixture.persistLogs(
      workspaceRoot,
      'beatrice',
      'local-setup/logs/beatrice.log',
    );
    DockerFixture.persistLogs(
      workspaceRoot,
      'qwen-tts',
      'local-setup/logs/tts.log',
    );
    DockerFixture.stopCompose(workspaceRoot);
    DockerFixture.cleanup();
    Logger.log(globalThis.__TEARDOWN_MESSAGE__);
  };
}
