import { chapterNarrationUpdateSubscriptionKey } from './chapter-narration-update-subscriptions-key.util';

describe(chapterNarrationUpdateSubscriptionKey.name, () => {
  it('should return the correct subscription key', () => {
    const chapterId = '3191544a-df97-41db-a873-193969abe056';

    const key = chapterNarrationUpdateSubscriptionKey(chapterId);

    expect(key).toBe(`CHAPTER_NARRATION_UPDATE_${chapterId}`);
  });
});
