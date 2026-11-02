import { render, screen } from '@testing-library/react';
import { createChart } from 'lightweight-charts';

import { ContentStatChart } from './ContentStatChart';

const chart = vi.hoisted(() => {
  const areaSeries = { setData: vi.fn() };
  const lineSeries = { setData: vi.fn() };

  return {
    areaSeries,
    lineSeries,
    fitContent: vi.fn(),
    api: {
      addSeries: vi.fn((kind: string) =>
        kind === 'Area' ? areaSeries : lineSeries,
      ),
      timeScale: () => ({ fitContent: chart.fitContent }),
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

const exact = [
  { time: '2026-10-30', value: 118 },
  { time: '2026-10-31', value: 124 },
];
const live = { time: '2026-11-01', value: 131 };

describe(ContentStatChart.name, () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    document.documentElement.style.removeProperty('--color-blue-400');
  });

  it('describes itself to assistive technology', () => {
    render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Novels' }),
    ).toBeInTheDocument();
  });

  it('fills the area with the exact days and draws nothing else without an estimate', () => {
    render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    expect(chart.areaSeries.setData).toHaveBeenCalledExactlyOnceWith(
      exact,
    );
    expect(chart.api.addSeries).toHaveBeenCalledOnce();
    expect(chart.fitContent).toHaveBeenCalledOnce();
  });

  it("continues the area to today's estimate with a dashed line", () => {
    render(
      <ContentStatChart series={{ exact, live }} label="Novels" />,
    );

    expect(chart.api.addSeries).toHaveBeenLastCalledWith(
      'Line',
      expect.objectContaining({ lineStyle: 2 }),
    );
    expect(chart.lineSeries.setData).toHaveBeenCalledExactlyOnceWith([
      exact[1],
      live,
    ]);
  });

  it('draws just the estimate when there are no exact days yet', () => {
    render(
      <ContentStatChart
        series={{ exact: [], live }}
        label="Novels"
      />,
    );

    expect(chart.lineSeries.setData).toHaveBeenCalledExactlyOnceWith([
      live,
    ]);
  });

  it('uses the fallback color when the theme has no token', () => {
    render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    expect(chart.api.addSeries).toHaveBeenCalledWith(
      'Area',
      expect.objectContaining({
        lineColor: '#8791f6',
        topColor: 'rgba(135, 145, 246, 0.35)',
        bottomColor: 'rgba(135, 145, 246, 0)',
      }),
    );
  });

  it('keeps a theme color it cannot split into channels as it is', () => {
    document.documentElement.style.setProperty(
      '--color-blue-400',
      'oklch(70% 0.15 260)',
    );

    render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    expect(chart.api.addSeries).toHaveBeenCalledWith(
      'Area',
      expect.objectContaining({
        lineColor: 'oklch(70% 0.15 260)',
        topColor: 'oklch(70% 0.15 260)',
      }),
    );
  });

  it('rebuilds the chart for a new series and removes the old one', () => {
    const { rerender } = render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    rerender(
      <ContentStatChart
        series={{ exact: [...exact], live }}
        label="Novels"
      />,
    );

    expect(chart.api.remove).toHaveBeenCalledOnce();
    expect(createChart).toHaveBeenCalledTimes(2);
  });

  it('removes the chart when it goes away', () => {
    const { unmount } = render(
      <ContentStatChart
        series={{ exact, live: null }}
        label="Novels"
      />,
    );

    unmount();

    expect(chart.api.remove).toHaveBeenCalledOnce();
  });
});
