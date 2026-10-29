import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LicenseDraftingAssistant } from './LicenseDraftingAssistant';

describe(LicenseDraftingAssistant.name, () => {
  const fetchMock = vi.fn();

  function respondWith(
    assistantMessage: string,
    conversation: unknown[],
  ) {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        data: {
          draftLicense: {
            assistantMessage,
            draft: null,
            draftChanged: false,
            recommendations: [],
            disclaimers: ['This is not legal advice.'],
            isReadyToFinalize: false,
            conversation,
          },
        },
      }),
    });
  }

  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('carries a conversation over two turns, sending the one the assistant returned', async () => {
    // Arrange
    const user = userEvent.setup();
    const firstConversation = [
      { role: 'USER', content: 'Can others remix my novel?' },
      { role: 'ASSISTANT', content: 'Yes, with credit.' },
    ];
    respondWith('Yes, with credit.', firstConversation);
    respondWith('Then CC BY 4.0 fits.', [
      ...firstConversation,
      { role: 'USER', content: 'And sell it?' },
      { role: 'ASSISTANT', content: 'Then CC BY 4.0 fits.' },
    ]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LicenseDraftingAssistant />
      </QueryClientProvider>,
    );
    const box = screen.getByLabelText('Your message');

    // Act
    await user.click(box);
    await user.paste('Can others remix my novel?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Yes, with credit.');
    await user.click(box);
    await user.paste('And sell it?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Then CC BY 4.0 fits.');

    // Assert
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondRequest.variables.input.conversation).toEqual(
      firstConversation,
    );
    expect(
      within(screen.getByRole('log'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'YouCan others remix my novel?',
      'AssistantYes, with credit.',
      'YouAnd sell it?',
      'AssistantThen CC BY 4.0 fits.',
    ]);
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('shows the draft of an answer next to the conversation, with its disclaimers', async () => {
    // Arrange
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (_url, init) => {
      const { query } = JSON.parse(init.body);

      if (query.includes('canonicalLicenses')) {
        return {
          json: async () => ({
            data: {
              canonicalLicenses: [
                {
                  id: 'CC-BY-4.0',
                  name: 'Creative Commons Attribution 4.0 International',
                  shortName: 'CC BY 4.0',
                  version: '4.0',
                  category: 'creative_commons',
                  officialUrl:
                    'https://creativecommons.org/licenses/by/4.0/legalcode',
                  summary: 'Share and adapt with credit.',
                  permissions: [],
                  limitations: [],
                  conditions: [],
                },
              ],
            },
          }),
        };
      }

      return {
        json: async () => ({
          data: {
            draftLicense: {
              assistantMessage: 'CC BY 4.0 fits what you describe.',
              draft: {
                title:
                  'Creative Commons Attribution 4.0 International',
                text: 'Attribution 4.0 International',
                source: {
                  type: 'CANONICAL',
                  canonicalId: 'CC-BY-4.0',
                },
              },
              draftChanged: true,
              recommendations: [],
              disclaimers: ['This is not legal advice.'],
              isReadyToFinalize: false,
              conversation: [],
            },
          },
        }),
      };
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LicenseDraftingAssistant />
      </QueryClientProvider>,
    );

    // Act
    await user.click(screen.getByLabelText('Your message'));
    await user.paste('Can others remix my novel?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // Assert
    expect(
      await screen.findByRole('heading', {
        name: 'Creative Commons Attribution 4.0 International',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is not legal advice.'),
    ).toBeVisible();
    expect(
      await screen.findByText('Canonical license: CC BY 4.0'),
    ).toBeInTheDocument();
  });
});
