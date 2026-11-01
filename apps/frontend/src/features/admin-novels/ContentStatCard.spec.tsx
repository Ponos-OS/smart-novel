import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { a11yViolations } from '../../test-utils/axe';
import { ContentStatCard } from './ContentStatCard';
import { ContentStatsCards } from './ContentStatsCards';
import {
  useContentStats,
  useStatsSnapshots,
} from './use-content-stats';

const chart = vi.hoisted(() => {
  const series = { setData: vi.fn() };

  return {
    series,
    api: {
      addSeries: vi.fn(() => series),
      timeScale: () => ({ fitContent: vi.fn() }),
      remove: vi.fn(),
    },
  };
});

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => chart.api),
  AreaSeries: 'Area',
  LineSeries: 'Line',
  ColorType: { Solid: 'solid' },
  LineStyle: { Dashed: 2 },
}));
vi.mock('./use-content-stats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./use-content-stats')>()),
  useContentStats: vi.fn(),
  useStatsSnapshots: vi.fn(),
}));

const snapshot = (day: string, novelCount: number) => ({
  id: crypto.randomUUID(),
  day: `${day}T00:00:00.000Z`,
  novelCount,
  chapterCount: novelCount * 12,
});
const history = (snapshots: ReturnType<typeof snapshot>[]) => ({
  snapshots,
  isLoading: false,
  isError: false,
});

describe(ContentStatCard.name, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T15:20:00.000Z'));
    chart.series.setData.mockClear();
    vi.mocked(useStatsSnapshots).mockReturnValue(
      history([
        snapshot('2026-10-30', 1190),
        snapshot('2026-10-31', 1198),
      ]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCard(
    props: Partial<Parameters<typeof ContentStatCard>[0]> = {},
  ) {
    return render(
      <ContentStatCard
        noun="novels"
        field="novelCount"
        estimate={1204}
        estimateFailed={false}
        {...props}
      />,
    );
  }

  it('should write the estimate compactly with a tilde and say it is an estimate', () => {
    renderCard();

    expect(screen.getByText('~1.2k')).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'About 1,204 novels, a database estimate',
      ),
    ).toBeInTheDocument();
  });

  it('should draw the exact days as an area and today as a dashed estimate', () => {
    renderCard();

    expect(chart.series.setData).toHaveBeenNthCalledWith(1, [
      { time: '2026-10-30', value: 1190 },
      { time: '2026-10-31', value: 1198 },
    ]);
    expect(chart.series.setData).toHaveBeenNthCalledWith(2, [
      { time: '2026-10-31', value: 1198 },
      { time: '2026-11-01', value: 1204 },
    ]);
    expect(
      screen.getByRole('img', {
        name: 'Novels over the last 30 days',
      }),
    ).toBeInTheDocument();
  });

  it('should list the same values in a table, marking the estimate', async () => {
    renderCard();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByText('Show the values as a table'));

    const rows = within(
      screen.getByRole('table', { name: 'Novels per day' }),
    ).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'DayNovels',
      '2026-10-301,190',
      '2026-10-311,198',
      '2026-11-01~1.2k (estimate)',
    ]);
  });

  it('should ask for the other range when it is picked', async () => {
    renderCard();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: '90 days' }));

    expect(useStatsSnapshots).toHaveBeenLastCalledWith(90);
    expect(
      screen.getByRole('button', { name: '90 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('should show the figure and a sentence instead of a lone point', () => {
    vi.mocked(useStatsSnapshots).mockReturnValue(history([]));

    renderCard();

    expect(screen.getByText('~1.2k')).toBeInTheDocument();
    expect(
      screen.getByText('The history builds up daily.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should show a skeleton while the history loads', () => {
    vi.mocked(useStatsSnapshots).mockReturnValue({
      snapshots: undefined,
      isLoading: true,
      isError: false,
    });

    renderCard();

    expect(
      screen.getByRole('status', {
        name: 'Loading the novels history',
      }),
    ).toBeInTheDocument();
  });

  it('should say the history failed and still show the figure', () => {
    vi.mocked(useStatsSnapshots).mockReturnValue({
      snapshots: undefined,
      isLoading: false,
      isError: true,
    });

    renderCard();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The novels history could not be loaded.',
    );
    expect(screen.getByText('~1.2k')).toBeInTheDocument();
  });

  it("should say when today's figure is missing, and draw the exact days alone", () => {
    renderCard({ estimate: undefined, estimateFailed: true });

    expect(screen.getByText('–')).toBeInTheDocument();
    expect(
      screen.getByText("Today's figure could not be loaded."),
    ).toBeInTheDocument();
    expect(chart.series.setData).toHaveBeenCalledOnce();
  });
});

describe(ContentStatsCards.name, () => {
  it('should give each card its own estimate', () => {
    vi.mocked(useContentStats).mockReturnValue({
      stats: {
        estimatedNovelCount: 1204,
        estimatedChapterCount: 14231,
      },
      isLoading: false,
      isError: false,
    });
    vi.mocked(useStatsSnapshots).mockReturnValue(history([]));

    render(<ContentStatsCards />);

    expect(screen.getByText('~1.2k')).toBeInTheDocument();
    expect(screen.getByText('~14.2k')).toBeInTheDocument();
  });
});

describe('content stat card accessibility', () => {
  beforeEach(() => {
    vi.mocked(useStatsSnapshots).mockReturnValue(
      history([
        snapshot('2026-10-30', 1190),
        snapshot('2026-10-31', 1198),
      ]),
    );
  });

  it.each([
    [
      'the chart and its table open',
      history([
        snapshot('2026-10-30', 1190),
        snapshot('2026-10-31', 1198),
      ]),
    ],
    [
      'a history that is loading',
      { snapshots: undefined, isLoading: true, isError: false },
    ],
    [
      'a history that failed',
      { snapshots: undefined, isLoading: false, isError: true },
    ],
    ['a history that has no days yet', history([])],
  ])('should have nothing wrong with %s', async (_name, state) => {
    vi.mocked(useStatsSnapshots).mockReturnValue(state);
    const { container } = render(
      <ContentStatCard
        noun="novels"
        field="novelCount"
        estimate={1204}
        estimateFailed={false}
      />,
    );
    await userEvent
      .setup()
      .click(
        screen.queryByText('Show the values as a table') ?? container,
      );

    expect(await a11yViolations(container)).toStrictEqual([]);
  });
});
