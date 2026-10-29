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
import {
  answer,
  answeredDraft,
  defaultHandlers,
  draftId,
  draftRow,
  type Handlers,
  installFetch,
  requestsFor,
  storageKey,
} from './test-support';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { sub: '230104087265432001' } }),
}));

describe(LicenseDraftingAssistant.name, () => {
  const fetchMock = vi.fn();
  let handlers: Handlers;

  const calls = (operation: string) =>
    requestsFor(fetchMock, operation);

  function renderAssistant(
    props: Parameters<typeof LicenseDraftingAssistant>[0] = {},
  ) {
    return render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <LicenseDraftingAssistant {...props} />
      </QueryClientProvider>,
    );
  }

  async function writeMessage(
    user: ReturnType<typeof userEvent.setup>,
    text: string,
  ) {
    await user.click(screen.getByLabelText('Your message'));
    await user.paste(text);
    await user.click(screen.getByRole('button', { name: 'Send' }));
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '0.05');
    vi.stubGlobal('fetch', fetchMock);
    handlers = defaultHandlers();
    installFetch(fetchMock, () => handlers);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  describe('starting', () => {
    it("writes a draft of the author's own, then shows the conversation and the draft", async () => {
      // Arrange
      const user = userEvent.setup();
      renderAssistant();

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Write my own' }),
      );

      // Assert
      expect(
        await screen.findByRole('region', { name: 'Draft license' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Conversation' }),
      ).toBeInTheDocument();
      expect(calls('CreateLicenseDraft')).toEqual([{ input: {} }]);
      expect(
        JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
      ).toEqual({
        draftId,
        conversation: [],
      });
    });

    it('offers to customize the license of the novel, only when there is one', async () => {
      // Arrange
      const user = userEvent.setup();
      const baseLicense = {
        id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        name: 'CC BY 4.0',
      };
      renderAssistant({ baseLicense });

      // Act
      await user.click(
        await screen.findByRole('button', {
          name: 'Customize CC BY 4.0',
        }),
      );

      // Assert
      await screen.findByRole('region', { name: 'Draft license' });
      expect(calls('CreateLicenseDraft')).toEqual([
        { input: { licenseId: baseLicense.id } },
      ]);
    });

    it('does not offer to customize when no license is given', async () => {
      // Act
      renderAssistant();

      // Assert
      await screen.findByRole('button', { name: 'Write my own' });
      expect(
        screen.queryByRole('button', { name: /Customize/ }),
      ).not.toBeInTheDocument();
    });

    it('says why a draft could not be started', async () => {
      // Arrange
      const user = userEvent.setup();
      handlers.CreateLicenseDraft = () => ({
        data: null,
        errors: [
          {
            message:
              'You have 20 unfinished license drafts. Finish or discard one first.',
            extensions: { code: 'BAD_REQUEST' },
          },
        ],
      });
      renderAssistant();

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Write my own' }),
      );

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Finish or discard one first',
      );
      expect(
        screen.queryByRole('region', { name: 'Draft license' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('unfinished drafts', () => {
    const unfinished = draftRow({
      title: 'Read it, do not copy it',
      text: 'You may read this novel. You may not copy it.',
    });

    beforeEach(() => {
      handlers.LicenseDrafts = () => ({
        data: {
          licenseDraftsConnection: { edges: [{ node: unfinished }] },
        },
      });
    });

    it('lists them and picks one up again, without its conversation', async () => {
      // Arrange
      const user = userEvent.setup();
      renderAssistant();

      // Act
      await user.click(
        await screen.findByRole('button', {
          name: 'Continue Read it, do not copy it',
        }),
      );

      // Assert
      expect(
        await screen.findByRole('heading', {
          name: 'Read it, do not copy it',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You may not copy it/),
      ).toBeInTheDocument();
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
      expect(calls('CreateLicenseDraft')).toEqual([]);
    });

    it('throws one away and shows the list again', async () => {
      // Arrange
      const user = userEvent.setup();
      handlers.DiscardLicenseDraft = () => ({
        data: { discardLicenseDraft: true },
      });
      renderAssistant();
      const discard = await screen.findByRole('button', {
        name: 'Discard Read it, do not copy it',
      });
      handlers.LicenseDrafts = () => ({
        data: { licenseDraftsConnection: { edges: [] } },
      });

      // Act
      await user.click(discard);

      // Assert
      await waitFor(() =>
        expect(
          screen.queryByText('Your unfinished drafts'),
        ).not.toBeInTheDocument(),
      );
      expect(calls('DiscardLicenseDraft')).toEqual([{ id: draftId }]);
    });
  });

  describe('working on a draft', () => {
    async function begin(user: ReturnType<typeof userEvent.setup>) {
      renderAssistant();
      await user.click(
        await screen.findByRole('button', { name: 'Write my own' }),
      );
      await screen.findByRole('region', { name: 'Draft license' });
    }

    it('carries the conversation over two turns and keeps it for the next visit', async () => {
      // Arrange
      const user = userEvent.setup();
      const first = answer().conversation;
      const second = [
        ...first,
        { role: 'USER', content: 'And explain section 3.' },
        { role: 'ASSISTANT', content: 'It covers resale.' },
      ];
      handlers.DraftLicense = vi
        .fn()
        .mockReturnValueOnce({ data: { draftLicense: answer() } })
        .mockReturnValueOnce({
          data: {
            draftLicense: answer({
              assistantMessage: 'It covers resale.',
              conversation: second,
              draftChanged: false,
            }),
          },
        });
      await begin(user);

      // Act
      await writeMessage(user, 'Forbid resale.');
      await screen.findByText('I forbade resale in section 3.');
      await writeMessage(user, 'And explain section 3.');
      await screen.findByText('It covers resale.');

      // Assert
      expect(calls('DraftLicense')[1].input.conversation).toEqual(
        first,
      );
      expect(
        within(screen.getByRole('log'))
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        'YouForbid resale.',
        'AssistantI forbade resale in section 3.',
        'YouAnd explain section 3.',
        'AssistantIt covers resale.',
      ]);
      await waitFor(() =>
        expect(
          JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
        ).toEqual({
          draftId,
          conversation: second,
        }),
      );
    });

    it('shows the draft of an answer next to the conversation, with its disclaimers', async () => {
      // Arrange
      const user = userEvent.setup();
      await begin(user);

      // Act
      await writeMessage(user, 'Forbid resale.');

      // Assert
      expect(
        await screen.findByRole('heading', {
          name: answeredDraft.title,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('This is not legal advice.'),
      ).toBeVisible();
    });

    it('saves what the assistant drafted on its own, and says so', async () => {
      // Arrange
      const user = userEvent.setup();
      await begin(user);

      // Act
      await writeMessage(user, 'Forbid resale.');

      // Assert
      await waitFor(() =>
        expect(calls('SaveLicenseDraft')).toHaveLength(1),
      );
      expect(calls('SaveLicenseDraft')[0].input).toEqual({
        id: draftId,
        title: answeredDraft.title,
        text: answeredDraft.text,
        source: answeredDraft.source,
      });
      await waitFor(() =>
        expect(screen.getByText('All changes saved')).toBeVisible(),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(calls('SaveLicenseDraft')).toHaveLength(1);
    });

    it('does not send the draft to the assistant while it has no text', async () => {
      // Arrange
      const user = userEvent.setup();
      await begin(user);

      // Act
      await writeMessage(user, 'Hello');
      await screen.findByText('I forbade resale in section 3.');

      // Assert
      expect(calls('DraftLicense')[0].input.draft).toBeNull();
    });

    it('starts over after saving what was not saved, keeping the draft among the unfinished ones', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '3600');
      await begin(user);
      await writeMessage(user, 'Forbid resale.');
      await screen.findByText('I forbade resale in section 3.');

      // Act
      await user.click(
        screen.getByRole('button', { name: 'Start over' }),
      );

      // Assert
      expect(
        await screen.findByRole('region', {
          name: 'Start a license draft',
        }),
      ).toBeInTheDocument();
      expect(calls('SaveLicenseDraft')).toHaveLength(1);
      expect(localStorage.getItem(storageKey)).toBeNull();
      expect(calls('DiscardLicenseDraft')).toEqual([]);
    });

    it('stays where it is, and says why, when the latest changes cannot be saved', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '3600');
      await begin(user);
      await writeMessage(user, 'Forbid resale.');
      await screen.findByText('I forbade resale in section 3.');
      handlers.SaveLicenseDraft = () => ({
        data: null,
        errors: [{ message: 'down', extensions: { code: 'X' } }],
      });

      // Act
      await user.click(
        screen.getByRole('button', { name: 'Start over' }),
      );

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'latest changes could not be saved',
      );
      expect(
        screen.getByRole('region', { name: 'Draft license' }),
      ).toBeInTheDocument();
    });

    describe('finalizing', () => {
      const license = {
        id: '9d1c5e7a-2b3f-4a60-8c91-0e2d4f6a8b10',
        name: 'CC BY 4.0 without resale',
        text: answeredDraft.text,
        sourceType: 'FORKED',
        canonicalId: 'CC-BY-4.0',
      };

      beforeEach(() => {
        vi.stubEnv('VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS', '3600');
      });

      it('saves the draft, finalizes it, hands the license over and goes back to the start', async () => {
        // Arrange
        const user = userEvent.setup();
        const onFinalized = vi.fn();
        handlers.FinalizeLicenseDraft = () => ({
          data: { finalizeLicenseDraft: license },
        });
        renderAssistant({ onFinalized });
        await user.click(
          await screen.findByRole('button', { name: 'Write my own' }),
        );
        await writeMessage(user, 'Forbid resale.');
        await screen.findByText('I forbade resale in section 3.');

        // Act
        await user.click(
          screen.getByRole('button', {
            name: 'Finalize this license',
          }),
        );

        // Assert
        await screen.findByRole('region', {
          name: 'Start a license draft',
        });
        expect(onFinalized).toHaveBeenCalledExactlyOnceWith(license);
        expect(calls('FinalizeLicenseDraft')).toEqual([
          { id: draftId },
        ]);
        expect(
          fetchMock.mock.calls
            .map(([, init]) => JSON.parse(init.body).query)
            .findIndex((q: string) => q.includes('SaveLicenseDraft')),
        ).toBeLessThan(
          fetchMock.mock.calls
            .map(([, init]) => JSON.parse(init.body).query)
            .findIndex((q: string) =>
              q.includes('FinalizeLicenseDraft'),
            ),
        );
        expect(localStorage.getItem(storageKey)).toBeNull();
      });

      it('does not finalize a draft it could not save', async () => {
        // Arrange
        const user = userEvent.setup();
        const onFinalized = vi.fn();
        handlers.FinalizeLicenseDraft = () => ({
          data: { finalizeLicenseDraft: license },
        });
        renderAssistant({ onFinalized });
        await user.click(
          await screen.findByRole('button', { name: 'Write my own' }),
        );
        await writeMessage(user, 'Forbid resale.');
        await screen.findByText('I forbade resale in section 3.');
        handlers.SaveLicenseDraft = () => ({
          data: null,
          errors: [{ message: 'down', extensions: { code: 'X' } }],
        });

        // Act
        await user.click(
          screen.getByRole('button', {
            name: 'Finalize this license',
          }),
        );

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'was not finalized',
        );
        expect(calls('FinalizeLicenseDraft')).toEqual([]);
        expect(onFinalized).not.toHaveBeenCalled();
      });

      it('shows why the backend refused to finalize, and keeps the draft', async () => {
        // Arrange
        const user = userEvent.setup();
        handlers.FinalizeLicenseDraft = () => ({
          data: null,
          errors: [
            {
              message:
                'This text is not the canonical license CC-BY-4.0, send it as FORKED or CUSTOM',
              extensions: { code: 'BAD_REQUEST' },
            },
          ],
        });
        renderAssistant();
        await user.click(
          await screen.findByRole('button', { name: 'Write my own' }),
        );
        await writeMessage(user, 'Forbid resale.');
        await screen.findByText('I forbade resale in section 3.');

        // Act
        await user.click(
          screen.getByRole('button', {
            name: 'Finalize this license',
          }),
        );

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'is not the canonical license',
        );
        expect(
          screen.getByRole('region', { name: 'Draft license' }),
        ).toBeInTheDocument();
      });
    });

    describe('suggested licenses', () => {
      beforeEach(() => {
        handlers.DraftLicense = () => ({
          data: {
            draftLicense: answer({ recommendations: ['CC-BY-4.0'] }),
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
              permissions: [],
              limitations: [],
              conditions: [],
              body: 'Attribution 4.0 International, the full legal text.',
            },
          },
        });
      });

      it('puts a sentence into the composer, after what the author wrote, and moves focus there', async () => {
        // Arrange
        const user = userEvent.setup();
        await begin(user);
        await writeMessage(user, 'Forbid resale.');
        const chip = await screen.findByRole('button', {
          name: 'Use CC BY 4.0',
        });
        const box = screen.getByLabelText('Your message');
        await user.click(box);
        await user.paste('Also for translations.');

        // Act
        await user.click(chip);

        // Assert
        expect(box).toHaveValue(
          'Also for translations.\nI would like to use CC BY 4.0 for my novel.',
        );
        expect(box).toHaveFocus();
        expect(calls('DraftLicense')).toHaveLength(1);
      });

      it('opens the license to read, and goes back to the button that opened it', async () => {
        // Arrange
        const user = userEvent.setup();
        await begin(user);
        await writeMessage(user, 'Forbid resale.');
        const read = await screen.findByRole('button', {
          name: 'Read CC BY 4.0',
        });

        // Act
        await user.click(read);
        const dialog = await screen.findByRole('dialog');
        const shown = await within(dialog).findByText(
          /the full legal text/,
        );
        const wasShown = shown.isConnected;
        await user.keyboard('{Escape}');

        // Assert
        expect(wasShown).toBeTrue();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(read).toHaveFocus();
      });
    });
  });

  describe('coming back', () => {
    const conversation = answer().conversation;

    function remember() {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ draftId, conversation }),
      );
    }

    it('shows the conversation that was kept and the draft the backend has', async () => {
      // Arrange
      remember();
      handlers.LicenseDraft = () => ({
        data: { licenseDraft: draftRow(answeredDraft) },
      });

      // Act
      renderAssistant();

      // Assert
      expect(
        await screen.findByText('Forbid resale.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('I forbade resale in section 3.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: answeredDraft.title }),
      ).toBeInTheDocument();
      expect(calls('CreateLicenseDraft')).toEqual([]);
    });

    it('does not save a draft it has just loaded', async () => {
      // Arrange
      remember();
      handlers.LicenseDraft = () => ({
        data: { licenseDraft: draftRow(answeredDraft) },
      });

      // Act
      renderAssistant();
      await screen.findByText('Forbid resale.');
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert
      expect(calls('SaveLicenseDraft')).toEqual([]);
    });

    it('goes on from the kept conversation', async () => {
      // Arrange
      const user = userEvent.setup();
      remember();
      handlers.LicenseDraft = () => ({
        data: { licenseDraft: draftRow(answeredDraft) },
      });
      renderAssistant();
      await screen.findByText('Forbid resale.');

      // Act
      await writeMessage(user, 'And explain section 3.');

      // Assert
      await waitFor(() =>
        expect(calls('DraftLicense')).toHaveLength(1),
      );
      expect(calls('DraftLicense')[0].input.conversation).toEqual(
        conversation,
      );
      expect(calls('DraftLicense')[0].input.draft).toEqual(
        answeredDraft,
      );
    });

    it('starts afresh, and forgets the session, when the draft is gone', async () => {
      // Arrange
      remember();
      handlers.LicenseDraft = () => ({
        data: null,
        errors: [
          {
            message: `License draft ${draftId} not found`,
            extensions: { code: 'NOT_FOUND' },
          },
        ],
      });

      // Act
      renderAssistant();

      // Assert
      expect(
        await screen.findByRole('region', {
          name: 'Start a license draft',
        }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(localStorage.getItem(storageKey)).toBeNull(),
      );
    });

    it('keeps the session, and offers to try again, when the draft cannot be loaded for another reason', async () => {
      // Arrange
      const user = userEvent.setup();
      remember();
      handlers.LicenseDraft = () => ({
        data: null,
        errors: [
          {
            message: 'down',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          },
        ],
      });
      renderAssistant();
      const retry = await screen.findByRole('button', {
        name: 'Try again',
      });
      handlers.LicenseDraft = () => ({
        data: { licenseDraft: draftRow(answeredDraft) },
      });

      // Act
      await user.click(retry);

      // Assert
      expect(
        await screen.findByText('Forbid resale.'),
      ).toBeInTheDocument();
      expect(localStorage.getItem(storageKey)).not.toBeNull();
    });
  });
});
