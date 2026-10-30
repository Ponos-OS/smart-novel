import axios from 'axios';

import { AuthorizationFixture } from '../support';

const PLATFORM_TERMS = `#graphql
  query PlatformTerms {
    platformTerms {
      version
      markdown
    }
  }
`;

const MY_STATUS = `#graphql
  query MyPlatformTermsStatus {
    myPlatformTermsStatus {
      requiredVersion
      acceptedVersion
      accepted
    }
  }
`;

const ACCEPT = `#graphql
  mutation AcceptPlatformTerms($version: Int!) {
    acceptPlatformTerms(version: $version) {
      requiredVersion
      acceptedVersion
      accepted
    }
  }
`;

const DRAFT_LICENSE = `#graphql
  mutation DraftLicense($input: DraftLicenseInput!) {
    draftLicense(input: $input) {
      assistantMessage
    }
  }
`;

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
    }
  }
`;

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

describe('Platform terms (e2e)', () => {
  const novelInput = {
    name: 'The Lantern Keeper',
    description: 'A lighthouse keeper finds a door in the fog.',
  };
  let version: number;

  beforeAll(async () => {
    const data = await graphql(PLATFORM_TERMS, {});

    version = data.data.platformTerms.version;
  });

  it('should serve the current terms without authentication', async () => {
    const data = await graphql(PLATFORM_TERMS, {});

    expect(data.errors).toBeUndefined();
    expect(data.data.platformTerms).toStrictEqual({
      version: expect.toBePositive(),
      markdown: expect.toStartWith('# Platform License'),
    });
  });

  describe('a writer who has not accepted them', () => {
    it('should be told the terms are not accepted', async () => {
      const authorization =
        await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

      const data = await graphql(MY_STATUS, {}, authorization);

      expect(data.data.myPlatformTermsStatus).toStrictEqual({
        requiredVersion: version,
        acceptedVersion: null,
        accepted: false,
      });
    });

    it('should not be able to create a novel, with a typed error', async () => {
      const authorization =
        await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

      const data = await graphql(
        CREATE_NOVEL,
        { input: novelInput },
        authorization,
      );

      expect(data.errors[0].extensions.code).toBe(
        'PLATFORM_TERMS_NOT_ACCEPTED',
      );
      expect(data.data).toBeNull();
    });

    it('should not be able to use the license assistant, with a typed error and before any Fithara call', async () => {
      const authorization =
        await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

      const data = await graphql(
        DRAFT_LICENSE,
        { input: { message: 'What license fits my novel?' } },
        authorization,
      );

      expect(data.errors[0].extensions.code).toBe(
        'PLATFORM_TERMS_NOT_ACCEPTED',
      );
    });

    it('should not be able to accept a version other than the current one', async () => {
      const authorization =
        await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

      const data = await graphql(
        ACCEPT,
        { version: version + 1 },
        authorization,
      );

      expect(data.errors[0].extensions.code).toBe(
        'PLATFORM_TERMS_VERSION_MISMATCH',
      );
    });

    it('should be able to write once they accept, and accepting again changes nothing', async () => {
      const authorization =
        await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

      const accepted = await graphql(
        ACCEPT,
        { version },
        authorization,
      );
      const acceptedAgain = await graphql(
        ACCEPT,
        { version },
        authorization,
      );
      const created = await graphql(
        CREATE_NOVEL,
        { input: novelInput },
        authorization,
      );

      expect(accepted.data.acceptPlatformTerms).toStrictEqual({
        requiredVersion: version,
        acceptedVersion: version,
        accepted: true,
      });
      expect(acceptedAgain.data).toStrictEqual(accepted.data);
      expect(created.errors).toBeUndefined();
    });
  });

  it('should not let a reader use the license assistant', async () => {
    const authorization =
      await AuthorizationFixture.getUserAuthorizationHeader();

    const data = await graphql(
      DRAFT_LICENSE,
      { input: { message: 'What license fits my novel?' } },
      authorization,
    );

    expect(data.errors).not.toBeEmpty();
    expect(data.data).toBeNull();
  });

  it('should require authentication to read the own status', async () => {
    const data = await graphql(MY_STATUS, {});

    expect(data.errors).toBeArray();
    expect(data.data).toBeFalsy();
  });
});
