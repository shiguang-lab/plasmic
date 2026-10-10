import ChartView from "@/wab/client/components/analytics/ChartView";
import {
  ChartFilters,
  useChartData,
} from "@/wab/client/components/analytics/useChartData";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import dayjs from "dayjs";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  times: [] as string[],
  series: [] as unknown[][],
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (s: string) => s }),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({
    data,
    children,
  }: {
    data: { time: string }[];
    children: React.ReactNode;
  }) => {
    mocks.times = data.map((row) => row.time);
    return <div>{children}</div>;
  },
  Line: ({ dataKey }: { dataKey: (row: { time: string }) => unknown }) => {
    mocks.series.push(mocks.times.map((time) => dataKey({ time })));
    return null;
  },
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
afterEach(() => {
  cleanup();
  mocks.times = [];
  mocks.series = [];
});
it("keeps dates from both experiment slices and renders missing observations as gaps", () => {
  const chartData: ReturnType<typeof useChartData> = {
    error: undefined,
    retry: vi.fn(),
    isLoading: false,
    isEmpty: false,
    paywall: false,
    analyticsQuery: {
      type: "impressions",
      data: {
        original: [
          { time: "2026-10-01", impressions: 4, unique_impressions: 3 },
        ],
        override: [
          { time: "2026-10-02", impressions: 8, unique_impressions: 5 },
        ],
      },
    },
    projectMeta: {
      pages: [],
      splits: [
        {
          id: "split1",
          name: "Experiment",
          type: "experiment",
          slices: [
            { id: "original", name: "Original" },
            { id: "override", name: "Override" },
          ],
        },
      ],
    },
  };
  const filters: ChartFilters = {
    teamId: "team1",
    projectId: "project1",
    splitId: "split1",
    timeRange: [dayjs("2026-10-01"), dayjs("2026-10-02")],
    event: "impressions",
    period: "day",
  };
  render(<ChartView {...filters} chartData={chartData} />);
  expect(mocks.times).toEqual(["2026-10-01", "2026-10-02"]);
  expect(mocks.series).toEqual([
    [4, null],
    [null, 8],
  ]);
});
