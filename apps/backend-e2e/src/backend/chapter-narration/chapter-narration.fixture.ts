import { NarrationStatus } from '@prisma/client';
import axios from 'axios';
import { retryAsync } from 'nestjs-backend-common';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

import { AuthorizationFixture } from '../../support';

interface TtsLogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  context: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  headers?: {
    traceparent?: string;
    [key: string]: string | undefined;
  };
}

export class ChapterNarrationFixture {
  private workspaceRoot: string;
  private testStartTime: Date;

  constructor() {
    this.workspaceRoot = path.resolve(__dirname, '../../../../');
    this.testStartTime = new Date();
  }

  async waitFor(
    novelId: string,
    chapterId: string,
    _toBe: NarrationStatus,
  ): Promise<string> {
    const maxAttempts = 15;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusRes = await axios.post('/graphql', {
        query: `#graphql
          query GetChapter($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                id
                narrationStatus
                narrationUrl
              }
            }
          }
        `,
        variables: {
          novelId,
          chapterId,
        },
      });
      const status =
        statusRes.data.data.novel.chapter.narrationStatus;
      if (status === 'READY') {
        return statusRes.data.data.novel.chapter.narrationUrl;
      }

      if (status === 'FAILED') {
        throw new Error('Narration generation failed');
      }
    }

    throw new Error('Narration generation timed out');
  }

  async generateChapterAudio(chapterId: string) {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();

    return axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id) {
              status
              narrationUrl
            }
          }
        `,
        variables: {
          id: chapterId,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );
  }

  beforeEach(): void {
    // Mark the start of a test to capture logs from this point forward
    this.testStartTime = new Date();
  }

  /**
   * Generates a W3C `traceparent` header value with a fresh trace_id and span_id (version `00`, sampled flag set).
   *
   * Use the returned `traceId` to assert which TTS calls were triggered by this request.
   */
  static generateTraceparent(): {
    traceparent: string;
    traceId: string;
  } {
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');
    const traceparent = `00-${traceId}-${spanId}-01`;

    return { traceparent, traceId };
  }

  /**
   * Asserts that a trace ID appears exactly once in TTS logs.
   */
  async thenTtsCalledOnceWith(traceId: string) {
    const maxAttempts = 10;
    const delayMs = 500;
    let count = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const logs = await this.getTtsLogs();
      const counts = this.getTraceIdCounts(logs);
      count = counts.get(traceId) || 0;

      if (count === 1) {
        break; // 👈 found it — short-circuit to keep tests fast on the happy path
      }

      if (count > 1) {
        break; // 👈 already over — no point waiting; let expect() fail with a useful diff
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    expect(count).toBe(1);
  }

  /**
   * Asserts that a trace ID does NOT appear in TTS logs.
   */
  async thenTtsNotCalledWith(traceId: string) {
    const logs = await this.getTtsLogs();
    const counts = this.getTraceIdCounts(logs);
    const count = counts.get(traceId) || 0;

    expect(count).toBe(0);
  }

  private getTraceIdCounts(logs: TtsLogEntry[]): Map<string, number> {
    const traceIds = this.extractTraceIds(logs);
    const counts = new Map<string, number>();

    for (const id of traceIds) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }

    return counts;
  }

  /**
   * Extract trace IDs from TTS request logs by parsing the `traceparent` header on each `Incoming POST /speak` entry.
   */
  private extractTraceIds(entries: TtsLogEntry[]): string[] {
    return entries
      .filter(
        (entry) =>
          entry.headers?.traceparent &&
          entry.message?.includes('Incoming POST') &&
          entry.url === '/speak',
      )
      .map((entry) =>
        ChapterNarrationFixture.traceIdFromTraceparent(
          entry.headers!.traceparent!,
        ),
      )
      .filter((id): id is string => id !== null);
  }

  /**
   * Parses the trace_id (middle segment) out of a W3C traceparent header.
   */
  private static traceIdFromTraceparent(
    traceparent: string,
  ): string | null {
    const parts = traceparent.split('-');

    if (parts.length !== 4 || parts[1].length !== 32) {
      return null;
    }

    return parts[1];
  }

  /**
   * Get TTS log entries from TTS container since the test started
   */
  private async getTtsLogs(): Promise<TtsLogEntry[]> {
    /** @description timestamp format for Docker (RFC3339) */
    const sinceTime = this.testStartTime.toISOString();
    const [error, rawLogs] = await retryAsync(
      async () =>
        execSync(
          `docker compose --profile backend-e2e logs tts --since ${sinceTime} --no-log-prefix`,
          {
            cwd: this.workspaceRoot,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'], // <== pipes stdin, stdout, stderr to this subprocess so we can capture container's logs
          },
        ),
      { retry: 0 },
    );

    if (error) {
      console.error('Error fetching TTS logs:', error);
      return [];
    }

    const lines = rawLogs.split('\n').filter((line) => line.trim());
    const entries: TtsLogEntry[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as TtsLogEntry;
        entries.push(parsed);
      } catch {
        // Skip non-JSON lines
      }
    }

    return entries;
  }
}
