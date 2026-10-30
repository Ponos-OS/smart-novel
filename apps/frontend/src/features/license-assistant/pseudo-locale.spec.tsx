import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { format, LicenseAssistantMessagesProvider } from './i18n';
import { LicenseDraftingAssistant } from './LicenseDraftingAssistant';
import {
  enMessages,
  type MessageKey,
  type Messages,
} from './messages';
import {
  answer,
  defaultHandlers,
  draftRow,
  type Handlers,
  installFetch,
  requestsFor,
} from './test-support';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { sub: '230104087265432001' } }),
}));

/** @description Every message upper-cased and wrapped, placeholders kept: any English that shows up is a string that bypassed the catalog. */
const pseudoMessages = Object.fromEntries(
  Object.entries(enMessages).map(([key, message]) => [
    key,
    `<<${message
      .split(/(\{\w+\})/)
      .map((part) =>
        part.startsWith('{') ? part : part.toUpperCase(),
      )
      .join('')}>>`,
  ]),
) as Messages;

const p = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => format(pseudoMessages[key], values);

describe('license assistant in another language', () => {
  const fetchMock = vi.fn();
  let handlers: Handlers;

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '3600');
    vi.stubGlobal('fetch', fetchMock);
    handlers = defaultHandlers();
    handlers.LicenseDrafts = () => ({
      data: {
        licenseDraftsConnection: {
          edges: [{ node: draftRow({ title: 'Read only' }) }],
        },
      },
    });
    handlers.CanonicalLicense = () => ({
      data: {
        canonicalLicense: {
          id: 'CC-BY-4.0',
          name: 'Creative Commons Attribution 4.0 International',
          shortName: 'CC BY 4.0',
          version: '4.0',
          category: 'creative_commons',
          officialUrl:
            'https://creativecommons.org/licenses/by/4.0/legalcode',
          summary: 'Share and adapt with credit.',
          permissions: ['share'],
          limitations: ['no warranty'],
          conditions: ['attribution'],
          body: 'Full legal text.',
        },
      },
    });
    handlers.DraftLicense = () => ({
      data: {
        draftLicense: answer({ recommendations: ['CC-BY-4.0'] }),
      },
    });
    installFetch(fetchMock, () => handlers);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('should show no catalog English on any state, and keep canonical ids as they are', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <LicenseAssistantMessagesProvider messages={pseudoMessages}>
          <LicenseDraftingAssistant
            baseLicense={{
              id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
              name: 'CC BY 4.0',
            }}
          />
        </LicenseAssistantMessagesProvider>
      </QueryClientProvider>,
    );
    const seen: string[] = [];
    const snapshot = () => seen.push(document.body.textContent ?? '');
    await screen.findByText('Read only');
    snapshot();

    // Act
    await user.click(
      screen.getByRole('button', { name: p('start.writeOwn') }),
    );
    await user.click(
      await screen.findByLabelText(p('composer.label')),
    );
    await user.paste('Forbid resale.');
    await user.click(
      screen.getByRole('button', { name: p('composer.send') }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: p('recommendations.read', { name: 'CC BY 4.0' }),
      }),
    );
    await screen.findByText('Full legal text.');
    snapshot();

    // Assert
    const english = Object.entries(enMessages)
      .filter(([, message]) => message.length >= 8)
      .filter(([, message]) => !message.includes('{'))
      .filter(([key]) =>
        seen.some((text) =>
          text.includes(enMessages[key as MessageKey]),
        ),
      );
    expect(english).toEqual([]);
    expect(requestsFor(fetchMock, 'CreateLicenseDraft')).toEqual([
      { input: {} },
    ]);
    expect(screen.getByRole('dialog')).toBeVisible();
    // The page behind the modal dialog is hidden from assistive technology.
    expect(
      screen.getByRole('button', {
        name: p('recommendations.use', { name: 'CC BY 4.0' }),
        hidden: true,
      }),
    ).toBeVisible();
  });
});
