import TeamPage from "@/wab/client/components/dashboard/TeamPage";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({
  data: undefined as any,
  app: { api: { getStorageItem: vi.fn(), addStorageItem: vi.fn() }, selfInfo: { id: "creator" } },
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({ showError: vi.fn() }));
vi.mock("@/wab/client/components/dashboard/DashboardPageLoading", () => ({ DashboardPageLoading: () => null }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({ useAppCtx: () => fixture.app }));
vi.mock("@/wab/client/env", () => ({ SELF_HOSTED: false }));
vi.mock("@/wab/client/hooks/useAsyncStrict", () => ({
  useAsyncFnStrict: () => [{ value: fixture.data }, vi.fn()], useAsyncStrict: () => ({}),
}));
vi.mock("@/wab/client/hooks/useProjectsFilter", () => ({ useProjectsFilter: () => ({ projects: [], databases: [] }) }));
vi.mock("@/wab/client/components/dashboard/page-utils", () => ({ documentTitle: () => null }));
vi.mock("@/wab/client/components/dashboard/WorkspaceSection", () => ({ default: () => null }));
vi.mock("@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamPage", () => ({ PlasmicTeamPage: () => null }));
vi.mock("@/wab/client/components/dashboard/FreeTrialModal", () => ({ default: ({ onConfirm }: { onConfirm: () => void }) => <div role="dialog"><button onClick={onConfirm}>Confirm trial</button></div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("ignores retired trial checks without closing an open dialog on a team-data refresh", async () => {
  const pending: ((value: string | null) => void)[] = [];
  fixture.app.api.getStorageItem.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const team = (id: string) => ({ id, name: id, onTrial: true, createdById: "creator" });
  fixture.data = { team: team("first"), projects: [], members: [], workspaces: [] };
  const view = render(<TeamPage teamId={"first" as any} />);
  fixture.data = { ...fixture.data, team: team("second") };
  view.rerender(<TeamPage teamId={"second" as any} />);
  await act(async () => pending[0](null));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(fixture.app.api.addStorageItem).not.toHaveBeenCalled();
  await act(async () => pending[1](null));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fixture.data = { ...fixture.data, team: { ...fixture.data.team } };
  view.rerender(<TeamPage teamId={"second" as any} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  await act(async () => pending[2]("true"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm trial" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
