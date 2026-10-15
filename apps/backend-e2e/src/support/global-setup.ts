import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { ClusterFixture } from './cluster.fixture';
import { Logger } from './logger';

declare global {
  var __TEARDOWN_MESSAGE__: string;
}
const workspaceRoot = resolve(__dirname, '../../../../');

export default async function setup() {
  Logger.section('Setting up Vitest globally');
  Logger.log('Cleaning up previous logs...');
  rmSync('local-setup/logs', { recursive: true, force: true });
  Logger.log(
    'Starting the e2e cluster (builds the production images)...',
  );
  ClusterFixture.start(workspaceRoot);
  Logger.section('Warming up Beatrice/Ollama');
  Logger.log('Sending a trivial LLM request to load the model...');
  ClusterFixture.warmupBeatrice(workspaceRoot);
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';

  // Clean up logic here (stopping the cluster).
  return async () => {
    mkdirSync(resolve(workspaceRoot, 'local-setup/logs'), {
      recursive: true,
    });
    ClusterFixture.persistLogs(
      workspaceRoot,
      'job/backend-init',
      'local-setup/logs/init-postgres.log',
    );
    ClusterFixture.persistLogs(
      workspaceRoot,
      'deploy/zitadel',
      'local-setup/logs/zitadel.log',
    );
    ClusterFixture.persistLogs(
      workspaceRoot,
      'deploy/backend',
      'local-setup/logs/backend.log',
    );
    ClusterFixture.persistLogs(
      workspaceRoot,
      'deploy/beatrice',
      'local-setup/logs/beatrice.log',
    );
    ClusterFixture.persistLogs(
      workspaceRoot,
      'deploy/openai-compatible-tts',
      'local-setup/logs/tts.log',
    );
    ClusterFixture.stop(workspaceRoot);
    Logger.log(globalThis.__TEARDOWN_MESSAGE__);
  };
}
