import { execSync } from 'node:child_process';

import { Logger } from './logger';

/** @description the workload name comes from infra/terraform/modules */
type Workload =
  | 'deploy/backend'
  | 'deploy/zitadel'
  | 'deploy/beatrice'
  | 'deploy/openai-compatible-tts'
  | 'job/backend-init';

const namespace = 'smart-novel';
const kubeconfig = 'infra/terraform/envs/local/smart-novel-config';
const kubectl = `kubectl --kubeconfig ${kubeconfig} -n ${namespace}`;

export class ClusterFixture {
  static persistLogs(
    cwd: string,
    workload: Workload,
    hostPath: string,
  ): void {
    try {
      execSync(`${kubectl} logs ${workload} > ${hostPath} 2>&1`, {
        cwd,
        stdio: 'inherit',
      });
    } catch (error) {
      Logger.warn(
        `Could not persist the logs of ${workload}: ${error}`,
      );
    }
  }

  /**
   * @description Builds the production images, creates the cluster and waits for everything to be ready.
   */
  static start(cwd: string): void {
    execSync('sh infra/scripts/start-dev.sh e2e', {
      cwd,
      stdio: 'inherit',
    });
  }

  static stop(cwd: string): void {
    execSync('sh infra/scripts/stop-dev.sh', {
      cwd,
      stdio: 'inherit',
    });
  }

  static warmupBeatrice(cwd: string): void {
    this.warmupBeatriceMutation(
      cwd,
      'explainWord',
      'mutation { explainWord(word: "hello", context: "hello world") { meaning } }',
    );
    this.warmupBeatriceMutation(
      cwd,
      'normalizeTextForTts',
      'mutation { normalizeTextForTts(text: "Dr. Smith met with 3 clients at 9am on 12/03/2024.") }',
    );
  }

  private static warmupBeatriceMutation(
    cwd: string,
    label: string,
    query: string,
  ): void {
    const body = JSON.stringify({ query });
    const startedAt = Date.now();

    try {
      execSync(
        `${kubectl} exec -i deploy/backend -- curl -sS --max-time 300 -H 'content-type: application/json' -d @- http://beatrice:3000/graphql`,
        {
          cwd,
          input: body,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5 * 60 * 1000,
        },
      );

      Logger.log(
        `Beatrice/Ollama warmup (${label}) completed in ${Math.round((Date.now() - startedAt) / 1000)}s`,
      );
    } catch (error) {
      Logger.warn(
        `Beatrice/Ollama warmup (${label}) failed (continuing anyway): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
