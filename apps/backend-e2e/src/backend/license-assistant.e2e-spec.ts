import { AuthorizationFixture, graphql } from '../support';

const DRAFT_LICENSE = `#graphql
  mutation DraftLicense($input: DraftLicenseInput!) {
    draftLicense(input: $input) {
      assistantMessage
      draft {
        name
        text
        sourceType
        canonicalID
      }
      draftChanged
      recommendations
      disclaimers
      isReadyToFinalize
      conversation {
        role
        content
      }
    }
  }
`;

describe('License assistant (e2e)', () => {
  let writer: string;

  beforeAll(async () => {
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });
  });

  describe('draftLicense', () => {
    it('should answer a question and leave the draft alone', async () => {
      const data = await graphql(
        DRAFT_LICENSE,
        { input: { message: 'What fits a remix-friendly novel?' } },
        writer,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.draftLicense).toStrictEqual({
        assistantMessage: expect.stringContaining('CC BY-NC 4.0'),
        draft: null,
        draftChanged: false,
        recommendations: ['CC-BY-NC-4.0'],
        disclaimers: [expect.stringContaining('not legal advice')],
        isReadyToFinalize: false,
        conversation: [
          {
            role: 'USER',
            content: 'What fits a remix-friendly novel?',
          },
          {
            role: 'ASSISTANT',
            content: expect.stringContaining('CC BY-NC 4.0'),
          },
        ],
      });
    });

    it('should give back the draft the assistant forked from a canonical license', async () => {
      const data = await graphql(
        DRAFT_LICENSE,
        {
          input: {
            message: 'Draft me a license for my novel',
            conversation: [
              { role: 'USER', content: 'What fits my novel?' },
              { role: 'ASSISTANT', content: 'CC BY-NC 4.0 fits.' },
            ],
            draft: {
              name: 'CC BY-NC 4.0',
              text: '# Creative Commons',
              sourceType: 'CANONICAL',
              canonicalID: 'CC-BY-NC-4.0',
            },
            preferences: { category: 'creative_commons' },
          },
        },
        writer,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.draftLicense).toMatchObject({
        draft: {
          name: 'Custom license (derived from CC BY-NC 4.0)',
          sourceType: 'FORKED',
          canonicalID: 'CC-BY-NC-4.0',
        },
        draftChanged: true,
        isReadyToFinalize: true,
        disclaimers: [
          expect.stringContaining('not legal advice'),
          expect.stringContaining('no longer equivalent'),
        ],
      });
      expect(data.data.draftLicense.conversation).toHaveLength(4);
    });

    it.each([
      {
        scenario: 'is longer than 2000 characters',
        input: { message: 'a'.repeat(2001) },
      },
      {
        scenario: 'is blank',
        input: { message: '   ' },
      },
      {
        scenario: 'comes with a conversation of more than 50 turns',
        input: {
          message: 'Hello',
          conversation: Array.from({ length: 51 }, () => ({
            role: 'USER',
            content: 'Hello',
          })),
        },
      },
    ])(
      'should refuse a request that $scenario',
      async ({ input }) => {
        const data = await graphql(DRAFT_LICENSE, { input }, writer);

        expect(data.errors).not.toBeEmpty();
        expect(data.data).toBeNull();
      },
    );

    it('should not let a writer who has not accepted the platform terms use it', async () => {
      const unaccepted =
        await AuthorizationFixture.getWriterAuthorizationHeader({
          fresh: true,
          acceptTerms: false,
        });

      const data = await graphql(
        DRAFT_LICENSE,
        { input: { message: 'Hello' } },
        unaccepted,
      );

      expect(data.errors[0].extensions.code).toBe(
        'PLATFORM_TERMS_NOT_ACCEPTED',
      );
    });
  });

  it('should not let a reader use the assistant', async () => {
    const authorization =
      await AuthorizationFixture.getUserAuthorizationHeader();

    const data = await graphql(
      DRAFT_LICENSE,
      { input: { message: 'Hello' } },
      authorization,
    );

    expect(data.errors).not.toBeEmpty();
    expect(data.data).toBeNull();
  });
});
