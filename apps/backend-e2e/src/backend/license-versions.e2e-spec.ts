import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, graphql } from '../support';

const CREATE_LICENSE_DRAFT = `#graphql
  mutation CreateLicenseDraft($input: CreateLicenseDraftInput!) {
    createLicenseDraft(input: $input) {
      id
      version
    }
  }
`;

const SAVE_LICENSE_DRAFT = `#graphql
  mutation SaveLicenseDraft($input: SaveLicenseDraftInput!) {
    saveLicenseDraft(input: $input) {
      id
      version
    }
  }
`;

const FINALIZE_LICENSE_DRAFT = `#graphql
  mutation FinalizeLicenseDraft($id: ID!) {
    finalizeLicenseDraft(id: $id) {
      id
      version
    }
  }
`;

describe('License versions (e2e)', () => {
  let writer: string;

  async function startDraft(input: Record<string, unknown>) {
    const data = await graphql(
      CREATE_LICENSE_DRAFT,
      { input },
      writer,
    );

    return data.data.createLicenseDraft as {
      id: string;
      version: string;
    };
  }

  async function save(
    id: string,
    changes: { name: string; text: string; sourceType: string },
    canonicalID?: string,
  ) {
    const data = await graphql(
      SAVE_LICENSE_DRAFT,
      { input: { id, canonicalID, ...changes } },
      writer,
    );

    return data.data.saveLicenseDraft as {
      id: string;
      version: string;
    };
  }

  async function finalize(id: string) {
    const data = await graphql(
      FINALIZE_LICENSE_DRAFT,
      { id },
      writer,
    );

    return data.data.finalizeLicenseDraft as {
      id: string;
      version: string;
    };
  }

  beforeAll(async () => {
    // A fresh writer: a writer may keep only 20 unfinished drafts.
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });
  });

  it('should number a license written from nothing 1, and not change it while the draft is edited', async () => {
    const draft = await startDraft({});

    const edited = await save(draft.id, {
      name: 'Read it, do not copy it',
      text: `You may read this novel. ${randomUUID()}`,
      sourceType: 'CUSTOM',
    });
    const editedAgain = await save(draft.id, {
      name: 'Read it, do not copy it',
      text: `You may read this novel twice. ${randomUUID()}`,
      sourceType: 'CUSTOM',
    });
    const finished = await finalize(draft.id);

    expect(draft.version).toBe('1');
    expect(edited.version).toBe('1');
    expect(editedAgain.version).toBe('1');
    expect(finished.version).toBe('1');
  });

  it('should number a draft started from a license of the writer one more than it, and keep the number when it is finalized', async () => {
    const first = await startDraft({});
    await save(first.id, {
      name: 'Read it, do not copy it',
      text: `You may read this novel. ${randomUUID()}`,
      sourceType: 'CUSTOM',
    });
    const firstEdition = await finalize(first.id);

    const second = await startDraft({ licenseID: firstEdition.id });
    await save(second.id, {
      name: 'Read it, do not copy it',
      text: `You may read this novel and quote it. ${randomUUID()}`,
      sourceType: 'CUSTOM',
    });
    const secondEdition = await finalize(second.id);
    const third = await startDraft({ licenseID: secondEdition.id });

    expect(firstEdition.version).toBe('1');
    expect(second.version).toBe('2');
    expect(secondEdition.version).toBe('2');
    expect(third.version).toBe('3');
  });

  it('should give back the stored license, with its own number, when the draft is finalized with a text that is stored already', async () => {
    const first = await startDraft({});
    await save(first.id, {
      name: 'Read it, do not copy it',
      text: `You may read this novel. ${randomUUID()}`,
      sourceType: 'CUSTOM',
    });
    const firstEdition = await finalize(first.id);
    const unchanged = await startDraft({
      licenseID: firstEdition.id,
    });

    const finished = await finalize(unchanged.id);

    expect(unchanged.version).toBe('2');
    expect(finished).toStrictEqual(firstEdition);
  });

  it('should number a fork of a canonical license 1, whatever version the registry gives it', async () => {
    const draft = await startDraft({ canonicalID: 'CC-BY-NC-4.0' });
    await save(
      draft.id,
      {
        name: 'My CC BY-NC',
        text: `A shorter license. ${randomUUID()}`,
        sourceType: 'FORKED',
      },
      'CC-BY-NC-4.0',
    );

    const finished = await finalize(draft.id);

    expect(draft.version).toBe('1');
    expect(finished.version).toBe('1');
  });

  it('should not let the client set it', async () => {
    const draft = await startDraft({});

    const data = await graphql(
      SAVE_LICENSE_DRAFT,
      {
        input: {
          id: draft.id,
          name: 'Mine',
          text: 'Text',
          sourceType: 'CUSTOM',
          version: '9',
        },
      },
      writer,
    );

    expect(data.errors).not.toBeEmpty();
    expect(data.data).toBeFalsy();
  });
});
