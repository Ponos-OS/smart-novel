import type { Mock } from 'vitest';

export const userId = '230104087265432001';
export const storageKey = `license-assistant:v1:${userId}`;
export const draftId = '5c1f4d0e-3b6a-4a57-9d3e-0b7a8f2c9e41';

export function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: draftId,
    title: '',
    text: '',
    updatedAt: '2026-10-29T09:30:00.000Z',
    source: { type: 'CUSTOM', canonicalId: null },
    ...overrides,
  };
}

export const answeredDraft = {
  title: 'CC BY 4.0 without resale',
  text: 'You may share and adapt this novel. You may not sell it.',
  source: { type: 'FORKED', canonicalId: 'CC-BY-4.0' },
};

export function answer(overrides: Record<string, unknown> = {}) {
  return {
    assistantMessage: 'I forbade resale in section 3.',
    draft: answeredDraft,
    draftChanged: true,
    recommendations: [],
    disclaimers: ['This is not legal advice.'],
    isReadyToFinalize: false,
    conversation: [
      { role: 'USER', content: 'Forbid resale.' },
      {
        role: 'ASSISTANT',
        content: 'I forbade resale in section 3.',
      },
    ],
    ...overrides,
  };
}

export interface Variables {
  id?: string;
  input?: Record<string, unknown>;
}

export type Handlers = Record<
  string,
  (variables: Variables) => unknown
>;

/** @description A backend that answers every operation the assistant makes. */
export function defaultHandlers(): Handlers {
  return {
    LicenseDrafts: () => ({
      data: { licenseDraftsConnection: { edges: [] } },
    }),
    CreateLicenseDraft: () => ({
      data: { createLicenseDraft: draftRow() },
    }),
    SaveLicenseDraft: (variables) => ({
      data: { saveLicenseDraft: draftRow({ ...variables.input }) },
    }),
    DraftLicense: () => ({ data: { draftLicense: answer() } }),
    CanonicalLicenses: () => ({
      data: {
        canonicalLicenses: [
          {
            id: 'CC-BY-4.0',
            name: 'Creative Commons Attribution 4.0 International',
            shortName: 'CC BY 4.0',
            version: '4.0',
            category: 'creative_commons',
            officialUrl:
              'https://creativecommons.org/licenses/by/4.0/legalcode',
            summary: 'Share and adapt with credit.',
            permissions: [],
            limitations: [],
            conditions: [],
          },
        ],
      },
    }),
  };
}

/** @description Routes the `fetch` of the generated hooks to the handler of the operation, looked up at call time so a test can swap one. */
export function installFetch(
  fetchMock: Mock,
  handlers: () => Handlers,
): void {
  fetchMock.mockImplementation(async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    const name = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
    const handler = handlers()[name];

    if (!handler) {
      throw new Error(`Nothing serves ${name}`);
    }

    return { json: async () => handler(variables) };
  });
}

/** @description The variables of every request made for an operation. */
export function requestsFor(fetchMock: Mock, operation: string) {
  return fetchMock.mock.calls
    .map(([, init]) => JSON.parse(init.body))
    .filter(
      ({ query }) =>
        query.includes(`${operation}(`) ||
        query.includes(`${operation} `),
    )
    .map(({ variables }) => variables);
}
