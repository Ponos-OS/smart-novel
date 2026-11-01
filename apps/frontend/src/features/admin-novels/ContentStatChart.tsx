import {
  AreaSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { type StatSeries } from './content-stat-series';

const FALLBACK = {
  line: '#8791f6',
  text: '#8f93a6',
  grid: '#2c3148',
};

const WHOLE_NUMBERS = {
  type: 'price',
  precision: 0,
  minMove: 1,
} as const;

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match) {
    return hex;
  }

  const [r, g, b] = [0, 2, 4].map((i) =>
    parseInt(match[1].slice(i, i + 2), 16),
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ContentStatChartProps {
  series: StatSeries;
  label: string;
}

/**
 * @description The exact days are the filled area; today's estimate continues it as a dashed line. The colors are read from the theme tokens when the chart is created, and the app only has one theme.
 */
export function ContentStatChart({
  series,
  label,
}: ContentStatChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;

    if (!element) {
      return;
    }

    const line = token('--color-blue-400', FALLBACK.line);
    const chart = createChart(element, {
      autoSize: true,
      handleScroll: false,
      handleScale: false,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: token('--color-gray-400', FALLBACK.text),
        fontFamily: 'Instrument Sans Variable, system-ui, sans-serif',
        attributionLogo: true,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: {
          color: token('--color-gray-700', FALLBACK.grid),
        },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true },
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: line,
      lineWidth: 2,
      topColor: withAlpha(line, 0.35),
      bottomColor: withAlpha(line, 0),
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: WHOLE_NUMBERS,
    });

    area.setData(series.exact);

    if (series.live) {
      const estimate = chart.addSeries(LineSeries, {
        color: line,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: WHOLE_NUMBERS,
      });
      const lastExact = series.exact.at(-1);

      estimate.setData(
        lastExact ? [lastExact, series.live] : [series.live],
      );
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [series]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-44 w-full"
    />
  );
}
