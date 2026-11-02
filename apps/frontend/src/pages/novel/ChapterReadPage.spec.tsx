import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { useGetChapterQuery } from '../../generated/graphql';
import { useReadChapters } from '../../hooks/useReadChapters';
import { ChapterReadPage } from './ChapterReadPage';
import { useNovelOutletContext } from './NovelLayout';

const novelId = '93fec4bf-2f66-4e4a-9572-7aa4871f1458';
const chapterId = 'e0e19c33-2e56-4f5f-9b7c-9c17e7dbd230';
const previousId = '4b1f0c52-7d3e-4c0a-9a55-1f6a2f8d7b10';
const nextId = '8a2d6e91-0c47-4b83-b6f1-5d9e3a7c2f64';

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual<object>('../../generated/graphql')),
  useGetChapterQuery: vi.fn(),
}));
vi.mock('../../hooks/useReadChapters', () => ({
  useReadChapters: vi.fn(),
}));
vi.mock('./NovelLayout', () => ({ useNovelOutletContext: vi.fn() }));
vi.mock('./ChapterContent', () => ({
  ChapterContent: (props: {
    chapter: { title: string };
    hasPrevious: boolean;
    hasNext: boolean;
    canEditContent: boolean;
    canManageTts: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onEditClick: () => void;
  }) => (
    <div>
      <h1>{props.chapter.title}</h1>
      <p>{`previous:${props.hasPrevious} next:${props.hasNext}`}</p>
      <p>{`edit:${props.canEditContent} tts:${props.canManageTts}`}</p>
      <button onClick={props.onPrevious}>go previous</button>
      <button onClick={props.onNext}>go next</button>
      <button onClick={props.onEditClick}>go edit</button>
    </div>
  ),
}));

const chapter = {
  id: chapterId,
  title: 'The Lighthouse Keeper',
  previous: { id: previousId },
  next: { id: nextId },
};

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

describe(ChapterReadPage.name, () => {
  const markAsRead = vi.fn();
  const scrollTo = vi.fn();

  function givenChapter(
    value: Record<string, unknown> | null,
    isLoading = false,
  ) {
    vi.mocked(useGetChapterQuery).mockReturnValue({
      data: value ? { novel: { chapter: value } } : undefined,
      isLoading,
    } as never);
  }

  function renderPage() {
    const router = createMemoryRouter(
      [
        {
          path: '/novel/:id/chapters/:chapterId',
          element: (
            <>
              <ChapterReadPage />
              <LocationProbe />
            </>
          ),
        },
        { path: '*', element: <LocationProbe /> },
      ],
      { initialEntries: [`/novel/${novelId}/chapters/${chapterId}`] },
    );

    return {
      user: userEvent.setup(),
      ...render(<RouterProvider router={router} />),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo);
    vi.mocked(useNovelOutletContext).mockReturnValue({
      novel: { id: novelId },
      canEditContent: true,
      canManageTts: false,
    } as never);
    vi.mocked(useReadChapters).mockReturnValue({
      markAsRead,
    } as never);
    givenChapter(chapter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('asks for the chapter of the url in the novel of the layout', () => {
    renderPage();

    expect(useGetChapterQuery).toHaveBeenCalledWith(
      { novelId, chapterId },
      { enabled: true },
    );
  });

  it('shows a spinner while the chapter loads', () => {
    givenChapter(null, true);

    renderPage();

    expect(
      screen.getByText('Loading chapter...'),
    ).toBeInTheDocument();
  });

  it('shows the spinner when there is no chapter yet', () => {
    givenChapter(null);

    renderPage();

    expect(
      screen.getByText('Loading chapter...'),
    ).toBeInTheDocument();
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it('hands the chapter and what the viewer may do to the content', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: chapter.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('previous:true next:true')).toBeVisible();
    expect(screen.getByText('edit:true tts:false')).toBeVisible();
  });

  it('tells the content there is no neighbour when the chapter has none', () => {
    givenChapter({ ...chapter, previous: null, next: null });

    renderPage();

    expect(
      screen.getByText('previous:false next:false'),
    ).toBeVisible();
  });

  it('marks the chapter as read and scrolls to the top once', () => {
    renderPage();

    expect(markAsRead).toHaveBeenCalledExactlyOnceWith(chapterId);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it.each([
    {
      button: 'go previous',
      path: `/novel/${novelId}/chapters/${previousId}`,
    },
    {
      button: 'go next',
      path: `/novel/${novelId}/chapters/${nextId}`,
    },
    {
      button: 'go edit',
      path: `/novel/${novelId}/chapters/${chapterId}/edit`,
    },
    { button: '← Back to Novel', path: `/novel/${novelId}` },
  ])('goes to $path from "$button"', async ({ button, path }) => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: button }));

    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it.each([
    { button: 'go previous', gap: 'previous' },
    { button: 'go next', gap: 'next' },
  ])(
    'stays put on "$button" when there is no $gap chapter',
    async ({ button }) => {
      givenChapter({ ...chapter, previous: null, next: null });
      const { user } = renderPage();

      await user.click(screen.getByRole('button', { name: button }));

      expect(screen.getByTestId('location')).toHaveTextContent(
        `/novel/${novelId}/chapters/${chapterId}`,
      );
    },
  );
});
