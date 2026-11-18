import { check } from 'k6';
import { type Options } from 'k6/options';

import {
  acceptPlatformTerms,
  tokensOf,
  zitadelOutputs,
} from './auth.ts';
import { send, sendStrict } from './client.ts';
import {
  browseFlow,
  type Sample,
  type SampleNovel,
  writeFlow,
} from './flows.ts';

interface Setup {
  tokens: { writer: string; user: string };
  sample: Sample;
}

export const options: Options = {
  hosts: { 'auth.localhost': '127.0.0.1' },
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '10s', target: 0 },
      ],
    },
    write: {
      executor: 'constant-arrival-rate',
      exec: 'write',
      rate: 2,
      timeUnit: '1s',
      duration: '1m30s',
      preAllocatedVUs: 5,
    },
  },
  thresholds: {
    'graphql_failures{scenario:browse}': ['rate<0.01'],
    'graphql_failures{scenario:write}': ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{scenario:write}': ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.99'],
  },
};

export async function setup(): Promise<Setup> {
  const tokens = await tokensOf(zitadelOutputs);

  acceptPlatformTerms(tokens.writer);

  const asWriter = sendStrict(tokens.writer);
  const asUser = sendStrict(tokens.user);
  const listed = asUser('GetNovels', {
    first: 20,
    where: { coverURLNotNil: true },
  });
  const novels: SampleNovel[] = [];

  for (const { node } of listed.data?.novels.edges ?? []) {
    const novel = asUser('GetNovel', { id: node.id }).data?.novel;
    const chapterIds: string[] = novel.chapters.edges.map(
      ({ node: chapter }: { node: { id: string } }) => chapter.id,
    );

    if (chapterIds.length > 0) {
      novels.push({ id: node.id, chapterIds });
    }
  }
  const tag = asUser('FilterTags', { first: 1 }).data?.tags.edges[0]
    ?.node.name;
  if (novels.length === 0 || !tag) {
    throw new Error(
      'the database has no novel with chapters and tags: seed it with DEVDATA_NOVELS_COUNT and DEVDATA_CHAPTERS_COUNT_PER_NOVEL',
    );
  }
  const sample = { novels, tag };

  browseFlow(asUser, sample, true);
  browseFlow(asWriter, sample, false);
  writeFlow(asWriter, 'setup');

  return { tokens, sample };
}

export function browse({ tokens, sample }: Setup): void {
  const asWriter = __VU % 2 === 0;
  const token = asWriter ? tokens.writer : tokens.user;
  const call = (name: string, variables: Record<string, unknown>) => {
    const result = send(name, variables, token);

    check(result, { [`${name} answered`]: (r) => !r.errors });

    return result;
  };

  browseFlow(call, sample, !asWriter);
}

export function write({ tokens }: Setup): void {
  const call = (name: string, variables: Record<string, unknown>) => {
    const result = send(name, variables, tokens.writer);

    check(result, { [`${name} answered`]: (r) => !r.errors });

    return result;
  };

  writeFlow(call, `${__VU}-${__ITER}-${Date.now()}`);
}

export function teardown({ tokens }: Setup): void {
  send('DeleteReadHistory', {}, tokens.user);
}
