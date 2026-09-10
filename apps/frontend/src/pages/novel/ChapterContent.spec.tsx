import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

import { NarrationStatus } from '../../generated/graphql';
import { ChapterContent } from './ChapterContent';

function renderChapterContent(
  props: ComponentProps<typeof ChapterContent>,
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ChapterContent {...props} />
    </QueryClientProvider>,
  );
}

const mutate = vi.fn();
let subscriptionPercent: number | null = null;

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  const useGetChapterQuery = Object.assign(() => undefined, {
    getKey: (variables: { novelId: string; chapterId: string }) => [
      'GetChapter',
      variables,
    ],
  });

  return {
    ...actual,
    useGenerateChapterAudioMutation: () => ({
      mutate,
      isPending: false,
    }),
    useGetChapterQuery,
  };
});

vi.mock('../../hooks/useChapterNarrationSubscription', () => ({
  useChapterNarrationSubscription: () => ({
    percent: subscriptionPercent,
  }),
}));

vi.mock('../../components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

const baseChapter = {
  id: '4dd92f16-4743-47b9-960c-6529678e9bc5',
  novelId: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  title: 'A Chapter',
  content: 'Chapter body text.',
  updatedAt: '2026-01-01T00:00:00.000Z',
  narrationStatus: null,
  narrationUrl: null,
};

describe('ChapterContent', () => {
  beforeEach(() => {
    mutate.mockReset();
    subscriptionPercent = null;
  });

  it('renders a single generate/regenerate audio button, not two', () => {
    // Arrange
    renderChapterContent({
      chapter: baseChapter,
      hasPrevious: false,
      hasNext: false,
      canManageTts: true,
    });

    // Act
    const generateButtons = screen.getAllByRole('button', {
      name: /Generate Audio|Regenerate Audio/,
    });

    // Assert
    expect(generateButtons.length).toBe(1);
  });

  it('does not render any writer-tools button when the viewer cannot manage TTS', () => {
    // Arrange
    renderChapterContent({
      chapter: baseChapter,
      hasPrevious: false,
      hasNext: false,
      canManageTts: false,
    });

    // Act
    const generateButton = screen.queryByRole('button', {
      name: '🔊 Generate Audio',
    });

    // Assert
    expect(generateButton).toBeNull();
  });

  it('renders the generate button enabled (no more hasTtsFriendlyContent-gated disabled state) when the viewer can manage TTS', () => {
    // Arrange
    renderChapterContent({
      chapter: baseChapter,
      hasPrevious: false,
      hasNext: false,
      canManageTts: true,
    });

    // Act
    const generateButton = screen.getByRole('button', {
      name: '🔊 Generate Audio',
    });

    // Assert
    expect(generateButton.hasAttribute('disabled')).toBe(false);
  });

  it('never links to a TTS review path', () => {
    // Arrange
    const { container } = renderChapterContent({
      chapter: baseChapter,
      hasPrevious: false,
      hasNext: false,
      canManageTts: true,
    });

    // Act
    const links = container.querySelectorAll('a');

    // Assert
    expect(links.length).toBe(0);
  });

  it('renders subscription-driven progress percent while processing', () => {
    // Arrange
    subscriptionPercent = 42;

    // Act
    renderChapterContent({
      chapter: {
        ...baseChapter,
        narrationStatus: NarrationStatus.Processing,
      },
      hasPrevious: false,
      hasNext: false,
      canManageTts: true,
    });

    // Assert
    expect(
      screen.getByText(/Generating audio\.\.\. 42%/),
    ).toBeTruthy();
  });

  it('renders no percent suffix while processing when the subscription has not reported one yet', () => {
    // Arrange
    subscriptionPercent = null;

    // Act
    renderChapterContent({
      chapter: {
        ...baseChapter,
        narrationStatus: NarrationStatus.Processing,
      },
      hasPrevious: false,
      hasNext: false,
      canManageTts: true,
    });

    // Assert
    expect(screen.getByText('Generating audio...')).toBeTruthy();
  });
});
