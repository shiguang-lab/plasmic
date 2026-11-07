import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { EditorHistoryControls } from "@/wab/client/components/top-bar/EditorHistoryControls";
import { providesStudioCtx } from "@/wab/client/contexts/StudioContexts";
import type { ApiPermission, ApiUser, GetProjectResponse, ProjectId, UserId } from "@/wab/shared/ApiSchema";
import { mock } from "vitest-mock-extended";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (message: string) => message }),
}));
afterEach(async () => { await act(async () => { cleanup(); }); });

it("updates real undo buttons at availability boundaries and preserves permission gating", async () => {
  const site = createSite();
  const component = mkComponent({
    name: "History",
    type: ComponentType.Plain,
    tplTree: (baseVariant) =>
      mkTplTagX("div", { baseVariant, name: "Initial" }),
  });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  sc.dbCtx().maybeObserveComponents([component]);
  sc.createViewStateUndoRecord();
  const root = ensureKnownTplTag(component.tplTree);
  const commit = vi.fn();
  const mounted = render(
    providesStudioCtx(sc)(
      <React.Profiler id="history" onRender={commit}>
        <EditorHistoryControls />
      </React.Profiler>,
    ),
  );
  const undo = screen.getByRole("button", {
    name: "Undo",
  }) as HTMLButtonElement;
  const redo = screen.getByRole("button", {
    name: "Redo",
  }) as HTMLButtonElement;
  const edit = (name: string) =>
    sc.changeUnsafe(() => {
      root.name = name;
    });
  try {
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    await act(() => edit("First"));
    expect(undo.disabled).toBe(false);
    commit.mockClear();
    await act(async () => {
      for (let i = 0; i < 20; i++) {await edit(`Next${i}`);}
    });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(undo);
    await waitFor(() => expect(root.name).toBe("Next18"));
    expect(redo.disabled).toBe(false);
    fireEvent.click(redo);
    await waitFor(() => expect(root.name).toBe("Next19"));
    expect(redo.disabled).toBe(true);
    act(() => {
      sc.editMode = false;
    });
    expect(undo.disabled).toBe(true);
    act(() => {
      sc.editMode = true;
    });
    expect(undo.disabled).toBe(false);
    mounted.unmount();
    commit.mockClear();
    await edit("After unmount");
    expect(commit).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    sc.dispose();
  }
});


it("rebinds the actual replaced undo owner and ignores obsolete owner events", async () => {
  const site = createSite();
  const component = mkComponent({ name: "History", type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, name: "Initial" }) });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  sc.dbCtx().maybeObserveComponents([component]);
  sc.createViewStateUndoRecord();
  const root = ensureKnownTplTag(component.tplTree);
  const rendered = vi.fn();
  const mounted = render(providesStudioCtx(sc)(<React.Profiler id="history-owner" onRender={rendered}><EditorHistoryControls /></React.Profiler>));
  const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
  const redo = screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;
  try {
    await act(async () => { await sc.changeUnsafe(() => { root.name = "First"; }); });
    expect(undo.disabled).toBe(false);
    const previous = sc.undoLog;
    act(() => { sc["clearUndoLog"](); });
    expect(sc.undoLog).not.toBe(previous);
    expect(sc.undoLogOwnerStore.getState()).toBe(sc.undoLog);
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    rendered.mockClear();
    act(() => { previous.undo(); });
    expect(previous.store.getState().canRedo).toBe(true);
    expect(redo.disabled).toBe(true);
    expect(rendered).not.toHaveBeenCalled();
    sc.createViewStateUndoRecord();
    await act(async () => { await sc.changeUnsafe(() => { root.name = "New owner edit"; }); });
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    await waitFor(() => expect(redo.disabled).toBe(false));
  } finally { mounted.unmount(); sc.dispose(); }
});


it("gates existing undo availability on real metadata and account permission changes", async () => {
  const projectId = "history-access" as ProjectId;
  const editor = mock<ApiUser>({ id: "history-editor" as UserId, email: "history@example.test" });
  const permission: ApiPermission = { id: "history-permission", projectId, workspaceId: null, teamId: null, userId: editor.id, email: editor.email, user: editor, accessLevel: "editor" };
  const site = createSite();
  const component = mkComponent({ name: "History", type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, name: "Initial" }) });
  site.components.push(component);
  const { studioCtx: sc, appCtx, api } = fakeStudioCtx({ site, siteInfo: { id: projectId, readableByPublic: false, createdById: "history-owner" as UserId, defaultAccessLevel: "viewer", perms: [permission] } });
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  appCtx.selfInfo = editor; appCtx.publishUiEnvironmentInputs();
  sc.dbCtx().maybeObserveComponents([component]);
  sc.createViewStateUndoRecord();
  const root = ensureKnownTplTag(component.tplTree);
  const mounted = render(providesStudioCtx(sc)(<EditorHistoryControls />));
  const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
  const metadata = (perms: ApiPermission[]) => Object.assign(mock<GetProjectResponse>(), { project: { ...sc.siteInfo }, perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
  try {
    await act(async () => { await sc.changeUnsafe(() => { root.name = "Editable change"; }); });
    expect(sc.undoLog.store.getState().canUndo).toBe(true);
    expect(undo.disabled).toBe(false);
    api.getSiteInfo.mockResolvedValueOnce(metadata([]));
    await act(async () => { await sc.refreshSiteInfo(); });
    expect(sc.undoLog.store.getState().canUndo).toBe(true);
    expect(sc.uiEnvironment.store.getState().canEditProject).toBe(false);
    expect(undo.disabled).toBe(true);
    api.getSiteInfo.mockResolvedValueOnce(metadata([permission]));
    await act(async () => { await sc.refreshSiteInfo(); });
    expect(undo.disabled).toBe(false);
    act(() => { appCtx.selfInfo = null; appCtx.publishUiEnvironmentInputs(); });
    expect(undo.disabled).toBe(true);
    act(() => { appCtx.selfInfo = editor; appCtx.publishUiEnvironmentInputs(); });
    expect(undo.disabled).toBe(false);
  } finally { mounted.unmount(); sc.dispose(); }
});
