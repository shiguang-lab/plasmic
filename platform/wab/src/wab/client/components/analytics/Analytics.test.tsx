import ChartView from "@/wab/client/components/analytics/ChartView";
import DataFilters from "@/wab/client/components/analytics/DataFilters";
import SharePageModal from "@/wab/client/components/analytics/SharePageModal";
import TeamFilters from "@/wab/client/components/analytics/TeamFilters";
import {
  ChartFilters,
  useChartData,
} from "@/wab/client/components/analytics/useChartData";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import dayjs from "dayjs";
import * as React from "react";
import { SWRConfig } from "swr";

const mocks = vi.hoisted(() => ({
  analytics: vi.fn(),
  metadata: vi.fn(),
  projects: vi.fn(),
  projectAnalytics: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({
    getTeamAnalytics: mocks.analytics,
    getProjectAnalytics: mocks.projectAnalytics,
    getProjectAnalayticsMeta: mocks.metadata,
    listTeamProjects: mocks.projects,
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (s: string) => s }),
}));
const filters: ChartFilters = {
  teamId: "team1",
  timeRange: [dayjs("2026-10-01"), dayjs("2026-10-10")],
  event: "impressions",
  period: "day",
};
function Chart(props: Partial<ChartFilters>) {
  const fullFilters = { ...filters, ...props };
  const chartData = useChartData(fullFilters);
  return (
    <>
      <ChartView {...fullFilters} chartData={chartData} />
      <DataFilters
        {...fullFilters}
        chartData={chartData}
        setEvent={vi.fn()}
        setPeriod={vi.fn()}
        setTimeRange={vi.fn()}
      />
    </>
  );
}
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        dedupingInterval: 0,
      }}
    >
      {children}
    </SWRConfig>
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("retries a real failed analytics resource and disables export while it is unavailable", async () => {
  mocks.analytics
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ type: "impressions", data: [] });
  render(<Chart />, { wrapper });
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(
    await screen.findByText("Failed to load analytics"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(
    await screen.findByText("No analytics data for these filters"),
  ).toBeInTheDocument();
  expect(mocks.analytics).toHaveBeenCalledTimes(2);
});

it("does not mistake metadata failures for an empty split result", async () => {
  mocks.projectAnalytics.mockResolvedValue({
    type: "impressions",
    data: { original: [{ time: "2026-10-01", impressions: 1 }] },
  });
  mocks.metadata.mockRejectedValue(new Error("No access"));
  render(<Chart projectId="project1" splitId="split1" />, { wrapper });
  expect(
    await screen.findByText("Failed to load analytics"),
  ).toBeInTheDocument();
  expect(screen.queryByText("No analytics data for these filters")).toBeNull();
});

it("shows filter failures with retry and forwards the selected real project id", async () => {
  mocks.projects
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({
      projects: [
        {
          id: "p1",
          name: "Project one",
          workspaceId: "w1",
          workspaceName: "Workspace one",
        },
      ],
    });
  const setProjectId = vi.fn();
  render(
    <TeamFilters
      teamId="team1"
      setWorkspaceId={vi.fn()}
      setProjectId={setProjectId}
      setComponentId={vi.fn()}
      setSplitId={vi.fn()}
    />,
    { wrapper },
  );
  await screen.findByText("Failed to load analytics filters");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(screen.queryByText("Failed to load analytics filters")).toBeNull(),
  );
  fireEvent.mouseDown(screen.getByLabelText("Project"));
  fireEvent.click(await screen.findByText("Project one"));
  expect(setProjectId).toHaveBeenCalledWith("p1");
  expect(screen.getByLabelText("Page / component")).toBeDisabled();
  expect(mocks.metadata).not.toHaveBeenCalled();
});

it("keys project metadata by both organization and project", async () => {
  mocks.projects.mockResolvedValue({ projects: [] });
  mocks.metadata.mockResolvedValue({ pages: [], splits: [] });
  const props = {
    projectId: "same-project",
    setWorkspaceId: vi.fn(),
    setProjectId: vi.fn(),
    setComponentId: vi.fn(),
    setSplitId: vi.fn(),
  };
  const view = render(<TeamFilters {...props} teamId="team1" />, { wrapper });
  await waitFor(() =>
    expect(mocks.metadata).toHaveBeenCalledWith("team1", "same-project"),
  );
  view.rerender(<TeamFilters {...props} teamId="team2" />);
  await waitFor(() =>
    expect(mocks.metadata).toHaveBeenCalledWith("team2", "same-project"),
  );
});

it("reports clipboard failure and allows copying the current filtered URL again", async () => {
  const writeText = vi
    .fn()
    .mockRejectedValueOnce(new Error("Blocked"))
    .mockResolvedValueOnce(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<SharePageModal />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await screen.findByText("Failed to copy link");
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByRole("button", { name: "Copied" })).toBeDisabled();
  expect(writeText).toHaveBeenLastCalledWith(window.location.href);
  expect(screen.queryByText("Failed to copy link")).toBeNull();
});
