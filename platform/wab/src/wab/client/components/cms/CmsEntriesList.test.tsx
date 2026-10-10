import CmsEntriesList from "@/wab/client/components/cms/CmsEntriesList";
import { ApiCmseRow } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  mutate: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({ createCmsRow: mocks.create }),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsTable: () => ({ id: "table1", name: "Articles" }),
  useMutateTableRows: () => mocks.mutate,
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: mocks.navigate }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: { databaseId: "db1", tableId: "table1" },
  }),
}));
vi.mock("@/wab/client/components/cms/CmsEntryItem", () => ({
  default: ({ row }: { row: ApiCmseRow }) => <div>{row.identifier}</div>,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({ reportError: vi.fn() }));

const rows = [
  {
    id: "r1",
    identifier: "Alpha",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  },
  {
    id: "r2",
    identifier: "Beta",
    createdAt: "2026-10-02",
    updatedAt: "2026-10-02",
  },
] as ApiCmseRow[];
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("filters actual entries and distinguishes loading, empty and no matches", async () => {
  const { rerender } = render(<CmsEntriesList />);
  expect(screen.getByRole("status")).toHaveAttribute(
    "aria-label",
    "Loading content entries…",
  );
  rerender(<CmsEntriesList rows={[]} />);
  expect(screen.getByText("No content entries yet")).toBeTruthy();
  rerender(<CmsEntriesList rows={rows} />);
  fireEvent.change(screen.getByLabelText("Search content entries"), {
    target: { value: "alpha" },
  });
  await waitFor(() => expect(screen.queryByText("Beta")).toBeNull());
  expect(screen.getByText("Alpha")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search content entries"), {
    target: { value: "missing" },
  });
  await screen.findByText("No matching content entries");
});

it("opens the created entry when refreshing the list fails", async () => {
  mocks.create.mockResolvedValueOnce({ id: "newrow" });
  mocks.mutate.mockRejectedValueOnce(new Error("Refresh failed"));
  render(<CmsEntriesList rows={rows} />);
  fireEvent.click(screen.getByRole("button", { name: "Add new entry" }));
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/cms/db1/content/models/table1/entries/newrow",
    ),
  );
  expect(screen.queryByText("Failed to create content entry")).toBeNull();
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it("shows creation failure without discarding the list and retries the real create action", async () => {
  mocks.create
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ id: "newrow" });
  mocks.mutate.mockResolvedValue(undefined);
  render(<CmsEntriesList rows={rows} />);
  fireEvent.click(screen.getByRole("button", { name: "Add new entry" }));
  await screen.findByText("Failed to create content entry");
  expect(screen.getByText("Alpha")).toBeTruthy();
  expect(mocks.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Add new entry" }));
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/cms/db1/content/models/table1/entries/newrow",
    ),
  );
  expect(mocks.create).toHaveBeenLastCalledWith("table1", {
    identifier: undefined,
    data: null,
    draftData: { "": {} },
  });
  expect(mocks.mutate).toHaveBeenCalledWith("table1");
});
