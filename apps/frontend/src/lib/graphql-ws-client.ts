import { context, propagation } from '@opentelemetry/api';
import { createClient } from 'graphql-ws';

function getWsUrl(): string {
  const serviceUrl = import.meta.env.VITE_SERVICE_URL;

  if (!serviceUrl) {
    throw new Error(
      'VITE_SERVICE_URL environment variable is not defined',
    );
  }

  // Replace http(s) with ws(s) and append /graphql
  return serviceUrl.replace(/^http/, 'ws') + '/graphql';
}

/**
 * Singleton graphql-ws client for GraphQL subscriptions.
 * Connects to the same backend as the HTTP fetcher, but over WebSocket.
 */
export const wsClient = createClient({
  url: getWsUrl(),
  // Lazy connection: only connects when the first subscription is created
  lazy: true,
  // Reconnect on connection loss for as long as somebody listens: a narration that is still running must not be left on a spinner because the network was down for a while. graphql-ws waits longer between tries by itself.
  retryAttempts: Infinity,
  // `connectionParams` is evaluated on every connection attempt, so the W3C `traceparent`/`baggage` headers are injected from the currently-active OTel context. The server-side `graphql-ws` plugin reads them out of `connectionParams` and continues the trace.
  connectionParams: () => {
    const carrier: Record<string, string> = {};

    propagation.inject(context.active(), carrier);

    return carrier;
  },
});
