import { isEmpty } from 'class-validator';
import { execSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Logger } from './logger';

/** @description the service name comes from the compose file */
type ServiceName =
  | 'backend-e2e'
  | 'zitadel'
  | 'init-postgres'
  | 'setup-zitadel'
  | 'qwen-tts'
  | 'beatrice';
/** @description the profile name comes from the compose file */
type ProfileName = 'backend-e2e' | 'frontend-e2e' | 'dev';

export class DockerFixture {
  /**
   * @description
   * Extract a file from the shared `zitadel-pat` Docker volume via the `backend-e2e` container (which mounts it read-only).
   */
  static extractFile(
    cwd: string,
    containerPath: string,
    hostFilePath: string,
  ): void {
    try {
      const fileContent = execSync(
        `docker compose -f compose.e2e.yml --profile backend-e2e exec -T backend-e2e cat ${containerPath}`,
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
    serviceName: ServiceName,
    hostPath: string,
  ): void {
    execSync(
      `docker compose -f compose.e2e.yml --profile backend-e2e logs ${serviceName} > ${hostPath} 2>&1`,
      {
        cwd,
        stdio: 'inherit',
      },
    );
  }

  static startCompose(cwd: string, serviceName: ServiceName): void {
    execSync(
      `docker compose -f compose.e2e.yml --profile backend-e2e up -d --build --wait ${serviceName}`,
      {
        cwd,
        stdio: 'inherit',
      },
    );
  }

  static stopCompose(cwd: string): void {
    execSync(
      `docker compose -f compose.e2e.yml --profile backend-e2e down -v`,
      {
        cwd,
        stdio: 'inherit',
      },
    );
  }

  static cleanup() {
    execSync(`docker system prune -f`, {
      stdio: 'inherit',
    });
    execSync('docker builder prune -f', {
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
        `docker compose -f compose.e2e.yml --profile backend-e2e exec -T backend-e2e curl -sS --max-time 300 -H 'content-type: application/json' -d @- http://beatrice:3000/graphql`,
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
