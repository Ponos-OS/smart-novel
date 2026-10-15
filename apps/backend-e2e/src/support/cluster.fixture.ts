import { isEmpty } from 'class-validator';
import { execSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Logger } from './logger';

/** @description the workload name comes from infra/terraform/modules */
type Workload =
  | 'deploy/backend'
  | 'deploy/zitadel'
  | 'deploy/beatrice'
  | 'deploy/openai-compatible-tts'
  | 'job/backend-init'
  | 'job/zitadel-setup';

const namespace = 'smart-novel';
const kubeconfig = 'infra/terraform/envs/local/smart-novel-config';
const kubectl = `kubectl --kubeconfig ${kubeconfig} -n ${namespace}`;

export class ClusterFixture {
  /**
   * @description
   * Extract a file from the shared ZITADEL credentials volume via the `backend` pod (which mounts it read-only).
   */
  static extractFile(
    cwd: string,
    containerPath: string,
    hostFilePath: string,
  ): void {
    try {
      const fileContent = execSync(
        `${kubectl} exec deploy/backend -- cat ${containerPath}`,
        {
          cwd,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      ).trim();

      if (isEmpty(fileContent)) {
        Logger.warn(`${containerPath} was empty`);
        return;
      }

      const outPath = path.resolve(cwd, hostFilePath);

      // Write atomically: any concurrent reader either sees the previous version or the new one, never a truncated/partial file. This prevents `JSON.parse` failures on `bot-key.json` if extraction ever overlaps with a read.
      const tmpPath = `${outPath}.${process.pid}.tmp`;
      writeFileSync(tmpPath, fileContent, 'utf-8');
      renameSync(tmpPath, outPath);
      Logger.log(
        `Extracted ${containerPath} → ${hostFilePath} (${fileContent.length} chars)`,
      );
    } catch (error) {
      Logger.warn(`Could not extract ${containerPath}: ${error}`);
    }
  }

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
