import 'reflect-metadata';

import {
  CHECK_POLICY_KEY,
  CheckPolicy,
} from './check-policy.decorator';

describe('CheckPolicy', () => {
  it("should default idArg to 'id'", () => {
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
      idArg: 'id',
    });
  });

  it('should carry a custom idArg', () => {
    class Test {
      @CheckPolicy('chapter', 'create', 'novelId')
      method() {}
    }

    const metadata = Reflect.getMetadata(
      CHECK_POLICY_KEY,
      Test.prototype.method,
    );

    expect(metadata).toStrictEqual({
      resource: 'chapter',
      action: 'create',
      idArg: 'novelId',
    });
  });
});
