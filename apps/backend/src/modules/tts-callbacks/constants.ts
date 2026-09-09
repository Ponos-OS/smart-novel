/**
 * @description
 * Redis pub/sub channel `statusCallbackUrl` publishes raw Beatrice status updates to.
 * Consumed later (Step 2.1/2.2) to persist the audio URL and bridge into the
 * `chapterNarrationUpdated` GraphQL subscription.
 */
export const TTS_STATUS_CHANNEL = 'tts-audio:status';
