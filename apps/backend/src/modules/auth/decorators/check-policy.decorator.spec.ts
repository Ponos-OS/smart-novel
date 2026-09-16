import 'reflect-metadata';

import {
  CHECK_POLICY_KEY,
  CheckPolicy,
} from './check-policy.decorator';

describe('CheckPolicy', () => {
  it('should attach resource and action metadata with no extractor', () => {
    class Test {
      @CheckPolicy('novel', 'read')
      method() {}
    }

    const metadata = Reflect.getMetadata(
      CHECK_POLICY_KEY,
      Test.prototype.method,
    );

    expect(metadata).toStrictEqual({
      resource: 'novel',
      action: 'read',
      extractResourceAttributes: undefined,
    });
  });

  it('should attach the extractor function as-is, so the guard can call it later', () => {
    const extractResourceAttributes = (args: {
      novelId: string;
    }) => ({
      novelId: args.novelId,
    });

    class Test {
      @CheckPolicy('chapter', 'create', extractResourceAttributes)
      method() {}
    }

    const metadata = Reflect.getMetadata(
      CHECK_POLICY_KEY,
      Test.prototype.method,
    );

    expect(metadata.resource).toBe('chapter');
    expect(metadata.action).toBe('create');
    expect(metadata.extractResourceAttributes).toBe(
      extractResourceAttributes,
    );
    expect(
      metadata.extractResourceAttributes({ novelId: 'novel-1' }),
    ).toStrictEqual({ novelId: 'novel-1' });
  });
});
