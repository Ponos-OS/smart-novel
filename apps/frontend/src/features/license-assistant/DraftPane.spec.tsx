import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LicenseSourceType } from '../../generated/graphql';
import { DraftPane } from './DraftPane';

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicensesQuery: () => ({
    data: {
      canonicalLicenses: [
        {
          id: 'CC-BY-4.0',
          shortName: 'CC BY 4.0',
          officialUrl:
            'https://creativecommons.org/licenses/by/4.0/legalcode',
        },
      ],
    },
  }),
}));

const draft = {
  title: 'CC BY 4.0 without resale',
  text: 'You may share and adapt this novel. You may not sell it.',
  source: {
    type: LicenseSourceType.Forked,
    canonicalId: 'CC-BY-4.0',
  },
};
const handlers = {
  onPrefill: vi.fn(),
  onViewLicense: vi.fn(),
  onFinalize: vi.fn(),
  isFinalizing: false,
  syncStatus: 'saved' as const,
};
const details = {
  disclaimers: ['This is not legal advice.'],
  recommendations: [],
  isReadyToFinalize: false,
  draftChanged: true,
};

describe(DraftPane.name, () => {
  it('asks the author to start the conversation when there is no draft yet', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={null}
        details={null}
        isPending={false}
      />,
    );

    // Assert
    expect(screen.getByText(/No draft yet/)).toBeInTheDocument();
    expect(screen.queryByText('Disclaimers')).not.toBeInTheDocument();
  });

  it('shows the draft with where it comes from', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={draft}
        details={details}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.getByRole('heading', {
        name: 'CC BY 4.0 without resale',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You may not sell it/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Modified from CC BY 4.0/),
    ).toBeInTheDocument();
  });

  it('shows the disclaimers of an answer that brought no draft, such as an explanation', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={null}
        details={{ ...details, draftChanged: false }}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.getByText('This is not legal advice.'),
    ).toBeVisible();
  });

  it('always carries the statement that a license is not legal advice and says nothing of ownership', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={null}
        details={null}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.getByText(
        'Licence information explains permissions; it does not determine who owns the copyright, and it is not legal advice.',
      ),
    ).toBeInTheDocument();
  });

  it.each([
    [true, 'The assistant updated the draft.'],
    [false, 'The draft did not change in this answer.'],
  ])(
    'says in words whether the draft changed (%s)',
    (draftChanged, sentence) => {
      // Act
      render(
        <DraftPane
          {...handlers}
          draft={draft}
          details={{ ...details, draftChanged }}
          isPending={false}
        />,
      );

      // Assert
      expect(
        screen
          .getAllByRole('status')
          .map((status) => status.textContent),
      ).toContain(sentence);
    },
  );

  it('keeps the draft on screen while the next answer is on its way', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={draft}
        details={details}
        isPending
      />,
    );

    // Assert
    expect(
      screen.getByRole('region', { name: 'Draft license' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/You may not sell it/)).toBeVisible();
  });

  it('keeps the very same elements for an answer that left the draft alone', () => {
    // Arrange
    const { rerender } = render(
      <DraftPane
        {...handlers}
        draft={draft}
        details={details}
        isPending={false}
      />,
    );
    const title = screen.getByRole('heading', {
      name: 'CC BY 4.0 without resale',
    });
    const body = screen.getByText(/You may not sell it/);

    // Act
    rerender(
      <DraftPane
        {...handlers}
        draft={{ ...draft, source: { ...draft.source } }}
        details={{ ...details, draftChanged: false }}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.getByRole('heading', {
        name: 'CC BY 4.0 without resale',
      }),
    ).toBe(title);
    expect(screen.getByText(/You may not sell it/)).toBe(body);
  });

  it('offers the licenses the assistant suggests, below the draft', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={draft}
        details={{ ...details, recommendations: ['CC-BY-4.0'] }}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.getByRole('region', { name: 'Suggested licenses' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use CC BY 4.0' }),
    ).toBeInTheDocument();
  });

  it('offers nothing when the assistant suggests nothing', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={draft}
        details={details}
        isPending={false}
      />,
    );

    // Assert
    expect(
      screen.queryByRole('region', { name: 'Suggested licenses' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['saved', 'All changes saved'],
    ['saving', 'Saving...'],
    ['unsaved', 'Changes not saved yet, saving soon'],
    ['failed', 'Not saved. Trying again.'],
  ] as const)(
    'says in words that the draft is %s',
    (syncStatus, sentence) => {
      // Act
      render(
        <DraftPane
          {...handlers}
          draft={draft}
          details={null}
          isPending={false}
          syncStatus={syncStatus}
        />,
      );

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent(sentence);
    },
  );

  it('shows the placeholder, not an empty license, for a draft that has no text yet', () => {
    // Act
    render(
      <DraftPane
        {...handlers}
        draft={{ ...draft, title: '', text: '' }}
        details={null}
        isPending={false}
      />,
    );

    // Assert
    expect(screen.getByText(/No draft yet/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Finalize this license' }),
    ).toBeDisabled();
  });

  describe('finalizing', () => {
    it("is the author's to ask for once the draft has a name and a text", async () => {
      // Arrange
      const onFinalize = vi.fn();
      render(
        <DraftPane
          {...handlers}
          onFinalize={onFinalize}
          draft={draft}
          details={details}
          isPending={false}
        />,
      );

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'Finalize this license' }),
      );

      // Assert
      expect(onFinalize).toHaveBeenCalledOnce();
    });

    it.each([
      ['a draft with no name', { ...draft, title: '  ' }],
      ['no draft', null],
    ])('cannot be asked for with %s', (_, noDraft) => {
      // Act
      render(
        <DraftPane
          {...handlers}
          draft={noDraft}
          details={null}
          isPending={false}
        />,
      );

      // Assert
      expect(
        screen.getByRole('button', { name: 'Finalize this license' }),
      ).toBeDisabled();
    });

    it("shows the assistant's opinion as a hint only", () => {
      // Act
      render(
        <DraftPane
          {...handlers}
          draft={draft}
          details={{ ...details, isReadyToFinalize: true }}
          isPending={false}
        />,
      );

      // Assert
      expect(
        screen.getByText(/The assistant thinks this draft is ready/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Finalize this license' }),
      ).toBeEnabled();
    });

    it('says it is finalizing and cannot be asked twice', () => {
      // Act
      render(
        <DraftPane
          {...handlers}
          draft={draft}
          details={details}
          isPending={false}
          isFinalizing
        />,
      );

      // Assert
      expect(
        screen.getByRole('button', { name: 'Finalizing...' }),
      ).toBeDisabled();
    });
  });
});
