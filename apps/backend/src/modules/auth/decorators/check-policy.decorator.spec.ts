import 'reflect-metadata';

import {
  CHECK_POLICY_KEY,
  CheckPolicy,
} from './check-policy.decorator';

describe('CheckPolicy', () => {
  it('should attach resource and action metadata', () => {
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
    });
  });
});
