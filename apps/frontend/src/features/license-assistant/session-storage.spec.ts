import { LicenseAssistantMessageRole } from '../../generated/graphql';
import {
  clearSession,
  loadSession,
  saveSession,
} from './session-storage';

const session = {
  draftId: '5c1f4d0e-3b6a-4a57-9d3e-0b7a8f2c9e41',
  conversation: [
    {
      role: LicenseAssistantMessageRole.User,
      content: 'Forbid resale.',
    },
    { role: LicenseAssistantMessageRole.Assistant, content: 'Done.' },
  ],
};

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives a writer back the session they saved', () => {
    // Arrange
    saveSession('230104087265432001', session);

    // Act
    const result = loadSession('230104087265432001');

    // Assert
    expect(result).toEqual(session);
  });

  it("keeps one writer's session from another writer on the same browser", () => {
    // Arrange
    saveSession('230104087265432001', session);

    // Act
    const result = loadSession('260311094522198751');

    // Assert
    expect(result).toBeNull();
  });

  it('forgets a session when asked', () => {
    // Arrange
    saveSession('230104087265432001', session);

    // Act
    clearSession('230104087265432001');

    // Assert
    expect(loadSession('230104087265432001')).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['an unrelated value', '"hello"'],
    ['a session without a draft', '{"conversation":[]}'],
    ['a session without a conversation', '{"draftId":"abc"}'],
  ])('ignores %s', (_, value) => {
    // Arrange
    localStorage.setItem(
      'license-assistant:v1:230104087265432001',
      value,
    );

    // Act
    const result = loadSession('230104087265432001');

    // Assert
    expect(result).toBeNull();
  });

  it('works without storage, which can be blocked or full', () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      () => {
        throw new Error('blocked');
      },
    );

    // Act
    const act = () => {
      saveSession('230104087265432001', session);
      clearSession('230104087265432001');

      return loadSession('230104087265432001');
    };

    // Assert
    expect(act).not.toThrow();
    expect(act()).toBeNull();
  });
});
