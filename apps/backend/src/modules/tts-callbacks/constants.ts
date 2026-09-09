/**
 * @description
 * Redis pub/sub channel `statusCallbackUrl` publishes raw Beatrice status updates to.
 * Consumed later (Step 2.1/2.2) to persist the audio URL and bridge into the
 * `chapterNarrationUpdated` GraphQL subscription.
 */
export const TTS_STATUS_CHANNEL = 'tts-audio:status';

/**
 * @description
 * Object-storage key prefix for Beatrice-generated audio, shared by the `genUploadUrl`
 * callback (which builds the presigned upload key) and the status-update subscriber
 * (which builds the same key to persist the final audio URL) — must stay in sync.
 */
export const TTS_AUDIO_OBJECT_KEY_PREFIX = 'tts-audio';
