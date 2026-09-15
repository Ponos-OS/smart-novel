import axios from 'axios';

import { AuthorizationFixture } from '../../support';

export class ChapterNarrationFixture {
  /**
   * @description Polls the chapter's `narrationUrl` until it's set, or throws after ~60 minutes.
   */
  async waitFor(novelId: string, chapterId: string): Promise<string> {
    const maxAttempts = 180;

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
