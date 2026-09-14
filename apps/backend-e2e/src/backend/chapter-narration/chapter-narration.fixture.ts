import axios from 'axios';

import { AuthorizationFixture } from '../../support';

export class ChapterNarrationFixture {
  /**
   * @description Polls the chapter's `narrationUrl` until it's set (the new Beatrice
   * flow never touches `narrationStatus`, only `narrationUrl` — see Step 2.1/3a), or
   * throws after ~5 minutes. Real CPU-based TTS synthesis (qwen-tts) has been observed
   * taking 200s+ for a single short chapter under concurrent e2e load (Beatrice serializes
   * jobs through one worker) — a 3-minute budget here was still too tight and was the
   * cause of flaky timeouts.
   */
  async waitFor(novelId: string, chapterId: string): Promise<string> {
    const maxAttempts = 150;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await axios.post('/graphql', {
        query: `#graphql
          query GetChapter($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                id
                narrationUrl
              }
            }
          }
        `,
        variables: {
          novelId,
          chapterId,
        },
      });
      const narrationUrl = res.data.data.novel.chapter.narrationUrl;

      if (narrationUrl) {
        return narrationUrl;
      }
    }

    throw new Error('Narration generation timed out');
  }

  async generateChapterAudio(chapterId: string) {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();

    return axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id) {
              status
              narrationUrl
            }
          }
        `,
        variables: {
          id: chapterId,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );
  }
}
