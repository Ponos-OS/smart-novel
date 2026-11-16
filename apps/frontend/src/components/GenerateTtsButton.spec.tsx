import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { NarrationStatus } from '../generated/graphql';
import { GenerateTtsButton } from './GenerateTtsButton';

const mutate = vi.fn();
let subscriptionOnData:
  | ((data: {
      chapterNarrationUpdated: {
        status: NarrationStatus;
        stage?: string | null;
        narrationURL?: string | null;
      };
    }) => void)
  | null = null;
let subscriptionOnConnected: (() => void) | undefined;
let subscriptionOnDisconnected: (() => void) | undefined;

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

vi.mock('../hooks/useGraphQLSubscription', () => ({
  useGraphQLSubscription: ({
    enabled,
    onData,
    onConnected,
    onDisconnected,
  }: {
    enabled: boolean;
    onData: typeof subscriptionOnData;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }) => {
    subscriptionOnData = enabled ? onData : null;
    subscriptionOnConnected = enabled ? onConnected : undefined;
    subscriptionOnDisconnected = enabled ? onDisconnected : undefined;
  },
}));

const queryClient = new QueryClient();

function renderButton(
  props: Partial<{
    novelId: string;
    chapterId: string;
    narrationStatus: NarrationStatus | null;
    narrationUrl: string | null;
  }> = {},
) {
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
    subscriptionOnData = null;
    subscriptionOnConnected = undefined;
    subscriptionOnDisconnected = undefined;
    vi.restoreAllMocks();
  });

  it('calls generateChapterAudio directly when there is no existing narration', () => {
    // Arrange
    renderButton({ narrationUrl: null });

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
    renderButton({
      narrationUrl:
        'https://storage.example.com/narrations/job-1.mp3',
    });

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
    renderButton({
      narrationUrl:
        'https://storage.example.com/narrations/job-1.mp3',
    });
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

  it('closes the regenerate confirmation with Cancel without calling the mutation', () => {
    // Arrange
    renderButton({
      narrationUrl:
        'https://storage.example.com/narrations/job-1.mp3',
    });
    fireEvent.click(
      screen.getByRole('button', { name: '🔄 Regenerate Audio' }),
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(
      screen.queryByText('Regenerate Audio Narration?'),
    ).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('never renders a link/navigation to a review path', () => {
    // Arrange
    const { container } = renderButton();

    // Act
    const links = container.querySelectorAll('a');

    // Assert
    expect(links.length).toBe(0);
  });

  it('shows a spinner and "Starting..." immediately after clicking, before any subscription event arrives', () => {
    // Arrange
    renderButton({ narrationUrl: null });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Assert
    expect(screen.getByText('Starting...')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '🔊 Generate Audio' }),
    ).toBeNull();
  });

  it.each([
    ['queued', 'Queued...'],
    ['generating', 'Generating...'],
    ['uploading', 'Uploading...'],
  ])(
    'maps the subscription stage "%s" to friendly text "%s"',
    (stage, expectedLabel) => {
      // Arrange
      renderButton({ narrationUrl: null });
      fireEvent.click(
        screen.getByRole('button', { name: '🔊 Generate Audio' }),
      );

      // Act
      act(() => {
        subscriptionOnData?.({
          chapterNarrationUpdated: {
            status: NarrationStatus.Processing,
            stage,
          },
        });
      });

      // Assert
      expect(screen.getByText(expectedLabel)).toBeTruthy();
    },
  );

  it('resets to the normal clickable button and shows a failure message when the subscription reports FAILED', () => {
    // Arrange
    renderButton({ narrationUrl: null });
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Act
    act(() => {
      subscriptionOnData?.({
        chapterNarrationUpdated: { status: NarrationStatus.Failed },
      });
    });

    // Assert
    expect(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    ).toBeTruthy();
    expect(screen.getByText('Audio generation failed.')).toBeTruthy();
  });

  it('resets to the normal clickable button and shows a failure message when the mutation itself errors', () => {
    // Arrange
    mutate.mockImplementation((_variables, { onError }) => {
      onError();
    });
    renderButton({ narrationUrl: null });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Assert
    expect(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    ).toBeTruthy();
    expect(screen.getByText('Audio generation failed.')).toBeTruthy();
  });

  it('switches to "Regenerate Audio" and clears the failure message once the subscription reports READY', () => {
    // Arrange
    renderButton({ narrationUrl: null });
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Act
    act(() => {
      subscriptionOnData?.({
        chapterNarrationUpdated: {
          status: NarrationStatus.Ready,
          narrationURL:
            'https://storage.example.com/narrations/job-1.mp3',
        },
      });
    });

    // Assert
    expect(
      screen.getByRole('button', { name: '🔄 Regenerate Audio' }),
    ).toBeTruthy();
    expect(screen.queryByText('Audio generation failed.')).toBeNull();
  });

  it('reads the chapter again each time the connection is up, since an event sent before or while it was down is lost', () => {
    // Arrange
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderButton({ narrationUrl: null });
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Act
    act(() => subscriptionOnConnected?.());

    // Assert
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [
        'GetChapter',
        {
          novelId: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
          chapterId: '4dd92f16-4743-47b9-960c-6529678e9bc5',
        },
      ],
    });
  });

  it('says it is reconnecting while the connection is down, and goes back to the stage once it is up', () => {
    // Arrange
    renderButton({ narrationUrl: null });
    fireEvent.click(
      screen.getByRole('button', { name: '🔊 Generate Audio' }),
    );

    // Act
    act(() => subscriptionOnDisconnected?.());
    const whileDown = screen.queryByText('Reconnecting...');
    act(() => subscriptionOnConnected?.());

    // Assert
    expect(whileDown).toBeTruthy();
    expect(screen.queryByText('Reconnecting...')).toBeNull();
    expect(screen.getByText('Starting...')).toBeTruthy();
  });

  it.each([
    [
      'READY',
      NarrationStatus.Ready,
      'https://storage.example.com/narrations/job-1.mp3',
      '🔄 Regenerate Audio',
    ],
    ['FAILED', NarrationStatus.Failed, null, '🔊 Generate Audio'],
  ])(
    'stops waiting when the chapter read again says %s, the event having been lost',
    (_name, status, narrationUrl, buttonName) => {
      // Arrange
      const view = renderButton({ narrationUrl: null });
      fireEvent.click(
        screen.getByRole('button', { name: '🔊 Generate Audio' }),
      );

      // Act
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <GenerateTtsButton
            novelId="c1d31ec2-f478-4648-b90b-d1e53de2a829"
            chapterId="4dd92f16-4743-47b9-960c-6529678e9bc5"
            narrationStatus={status}
            narrationUrl={narrationUrl}
          />
        </QueryClientProvider>,
      );

      // Assert
      expect(
        screen.getByRole('button', { name: buttonName }),
      ).toBeTruthy();
    },
  );
});
