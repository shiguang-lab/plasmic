import {
  CmsEntryHistory,
  EntryRevisionView,
} from "@/wab/client/components/cms/CmsEntryHistory";
import { CmsDatabaseId, CmsRowId, CmsTableId } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  history: {
    revisions: undefined as unknown,
    error: undefined as unknown,
    mutate: vi.fn(),
  },
  row: { row: { revision: 7 }, error: undefined as unknown, mutate: vi.fn() },
  revision: {
    revision: { data: { "": { title: "Old version" } } },
    error: undefined as unknown,
    mutate: vi.fn(),
  },
  database: {
    database: { extraData: { locales: [] } },
    error: undefined as unknown,
    mutate: vi.fn(),
  },
  update: vi.fn(),
  mutate: vi.fn(),
  navigate: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsRowHistory: () => mocks.history,
  useCmsRow: () => mocks.row,
  useCmsRowRevision: () => mocks.revision,
  useCmsDatabase: () => mocks.database,
  useCmsTable: () => ({ id: "table1" }),
  useMutateRow: () => mocks.mutate,
}));
vi.mock("@/wab/client/api-hooks", () => ({
  useUsersMap: () => ({ data: {} }),
}));
vi.mock("@/wab/client/components/cms/CmsEntryDetails", () => ({
  renderContentEntryFormFields: (
    _table: unknown,
    _db: unknown,
    _locales: unknown,
    disabled: boolean,
  ) => (
    <input
      aria-label="Revision title"
      disabled={disabled}
      defaultValue="Old version"
    />
  ),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({ updateCmsRow: mocks.update }),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: mocks.confirm,
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: mocks.navigate }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: {
      databaseId: "db1",
      tableId: "table1",
      rowId: "row1",
      revisionId: "rev1",
    },
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.history.revisions = undefined;
  mocks.history.error = undefined;
  mocks.row.error = undefined;
  mocks.revision.error = undefined;
  mocks.database.error = undefined;
  mocks.confirm.mockResolvedValue(true);
  mocks.update.mockResolvedValue(undefined);
  mocks.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("shows history loading, a retryable failure and an empty state", async () => {
  const { rerender } = render(
    <CmsEntryHistory
      databaseId={"db1" as CmsDatabaseId}
      tableId={"table1" as CmsTableId}
      rowId={"row1" as CmsRowId}
    />,
  );
  expect(screen.getByRole("status")).toHaveAttribute(
    "aria-label",
    "Loading revision history…",
  );
  mocks.history.error = new Error("offline");
  rerender(
    <CmsEntryHistory
      databaseId={"db1" as CmsDatabaseId}
      tableId={"table1" as CmsTableId}
      rowId={"row1" as CmsRowId}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.history.mutate).toHaveBeenCalledOnce();
  mocks.history.revisions = [];
  rerender(
    <CmsEntryHistory
      databaseId={"db1" as CmsDatabaseId}
      tableId={"table1" as CmsTableId}
      rowId={"row1" as CmsRowId}
    />,
  );
  expect(screen.getByText("No revision history")).toBeVisible();
});

it("retains read-only revision fields and retries failed writes using the current revision", async () => {
  mocks.update.mockRejectedValueOnce(new Error("offline"));
  render(<EntryRevisionView />);
  expect(screen.getByLabelText("Revision title")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await screen.findByText("Failed to restore revision");
  expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/cms/db1/content/models/table1/entries/row1",
    ),
  );
  expect(mocks.update).toHaveBeenLastCalledWith("row1", {
    draftData: { "": { title: "Old version" } },
    revision: 7,
    noMerge: true,
  });
});

it("retries only refresh after a successful write", async () => {
  mocks.mutate.mockRejectedValueOnce(new Error("offline"));
  render(<EntryRevisionView />);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await screen.findByText("Revision restored, but refreshing failed");
  expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.mutate).toHaveBeenCalledTimes(2);
});

it("honors cancellation and prevents duplicate confirmation or writes", async () => {
  mocks.confirm.mockResolvedValueOnce(false);
  render(<EntryRevisionView />);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
  expect(mocks.update).not.toHaveBeenCalled();
  let finish: ((result: boolean) => void) | undefined;
  mocks.confirm.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(mocks.confirm).toHaveBeenCalledTimes(2);
  finish?.(true);
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
});
