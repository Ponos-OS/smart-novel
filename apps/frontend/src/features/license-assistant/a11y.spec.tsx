import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { a11yViolations } from '../../test-utils/axe';
import { LicenseDraftingAssistant } from './LicenseDraftingAssistant';
import {
  answer,
  defaultHandlers,
  draftRow,
  type Handlers,
  installFetch,
} from './test-support';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { sub: '230104087265432001' } }),
}));

describe('license assistant accessibility', () => {
  const fetchMock = vi.fn();
  let handlers: Handlers;

  function renderAssistant() {
    return render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <LicenseDraftingAssistant
          baseLicense={{
            id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
            name: 'CC BY 4.0',
          }}
        />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '3600');
    vi.stubGlobal('fetch', fetchMock);
    handlers = defaultHandlers();
    handlers.LicenseDrafts = () => ({
      data: {
        licenseDraftsConnection: {
          edges: [
            {
              node: draftRow({
                title: 'Read it, do not copy it',
                text: 'You may read this novel.',
              }),
            },
          ],
        },
      },
    });
    installFetch(fetchMock, () => handlers);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('has nothing wrong on the start panel', async () => {
    // Arrange
    const { container } = renderAssistant();
    await screen.findByText('Read it, do not copy it');

    // Act
    const violations = await a11yViolations(container);

    // Assert
    expect(violations).toEqual([]);
  });

  it('has nothing wrong in a conversation with a draft, suggestions and disclaimers', async () => {
    // Arrange
    const user = userEvent.setup();
    handlers.DraftLicense = () => ({
      data: {
        draftLicense: answer({
          draft: {
            title: 'CC BY 4.0 without resale',
            text: '# CC BY 4.0 without resale\n\n## Section 3\n\nYou may not sell it.',
            source: { type: 'FORKED', canonicalId: 'CC-BY-4.0' },
          },
          recommendations: ['CC-BY-4.0'],
        }),
      },
    });
    const { container } = renderAssistant();
    await user.click(
      await screen.findByRole('button', { name: 'Write my own' }),
    );
    await user.click(await screen.findByLabelText('Your message'));
    await user.paste('Forbid resale.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Use CC BY 4.0' });

    // Act
    const violations = await a11yViolations(container);

    // Assert
    expect(violations).toEqual([]);
  });

  it('has nothing wrong with the license dialog open or an error announced', async () => {
    // Arrange
    const user = userEvent.setup();
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
          body: '# Attribution 4.0\n\nThe full legal text.',
        },
      },
    });
    handlers.DraftLicense = () => ({
      data: {
        draftLicense: answer({ recommendations: ['CC-BY-4.0'] }),
      },
    });
    renderAssistant();
    await user.click(
      await screen.findByRole('button', { name: 'Write my own' }),
    );
    await user.click(await screen.findByLabelText('Your message'));
    await user.paste('Forbid resale.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(
      await screen.findByRole('button', { name: 'Read CC BY 4.0' }),
    );
    await screen.findByText('The full legal text.');

    // Act
    const violations = await a11yViolations(document.body);

    // Assert
    expect(violations).toEqual([]);
  });

  it('closes the license dialog with Escape and gives the focus back to the button that opened it', async () => {
    // Arrange
    const user = userEvent.setup();
    handlers.DraftLicense = () => ({
      data: {
        draftLicense: answer({ recommendations: ['CC-BY-4.0'] }),
      },
    });
    renderAssistant();
    await user.click(
      await screen.findByRole('button', { name: 'Write my own' }),
    );
    await user.click(await screen.findByLabelText('Your message'));
    await user.paste('Forbid resale.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const opener = await screen.findByRole('button', {
      name: 'Read CC BY 4.0',
    });
    await user.click(opener);
    await screen.findByRole('dialog');

    // Act
    await user.keyboard('{Escape}');

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('moves the focus to the message box when a draft opens, and back to the start panel when it is left', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAssistant();

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Write my own' }),
    );

    // Assert
    expect(
      await screen.findByLabelText('Your message'),
    ).toHaveFocus();

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Start over' }),
    );

    // Assert
    expect(
      await screen.findByRole('heading', {
        name: 'Start a license draft',
      }),
    ).toHaveFocus();
  });

  it('does not take the focus when the start panel is the first thing shown', async () => {
    // Act
    renderAssistant();
    await screen.findByRole('button', { name: 'Write my own' });

    // Assert
    expect(document.body).toHaveFocus();
  });
});
