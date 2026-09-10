import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';

import { GenerateTtsButton } from './GenerateTtsButton';

const mutate = vi.fn();

vi.mock('../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../generated/graphql')
  >('../generated/graphql');

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

function renderButton(
  props: Partial<{
    novelId: string;
    chapterId: string;
    hasNarrationUrl: boolean;
  }> = {},
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <GenerateTtsButton
        novelId="c1d31ec2-f478-4648-b90b-d1e53de2a829"
        chapterId="4dd92f16-4743-47b9-960c-6529678e9bc5"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('GenerateTtsButton', () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it('calls generateChapterAudio directly when there is no existing narration', () => {
    // Arrange
    renderButton({ hasNarrationUrl: false });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Assert
    expect(mutate).toHaveBeenCalledWith(
      { id: '4dd92f16-4743-47b9-960c-6529678e9bc5' },
      expect.any(Object),
    );
  });

  it('shows the regenerate-confirmation modal instead of calling the mutation immediately when narration already exists', () => {
    // Arrange
    renderButton({ hasNarrationUrl: true });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: '🔄 Regenerate Audio' }),
    );

    // Assert
    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText('Regenerate Audio Narration?'),
    ).toBeTruthy();
  });

  it('calls the mutation once the regenerate confirmation is accepted', () => {
    // Arrange
    renderButton({ hasNarrationUrl: true });
    fireEvent.click(
      screen.getByRole('button', { name: '🔄 Regenerate Audio' }),
    );

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Yes, Regenerate' }),
    );

    // Assert
    expect(mutate).toHaveBeenCalledWith(
      { id: '4dd92f16-4743-47b9-960c-6529678e9bc5' },
      expect.any(Object),
    );
  });

  it('never renders a link/navigation to a review path', () => {
    // Arrange
    const { container } = renderButton();

    // Act
    const links = container.querySelectorAll('a');

    // Assert
    expect(links.length).toBe(0);
  });
});
