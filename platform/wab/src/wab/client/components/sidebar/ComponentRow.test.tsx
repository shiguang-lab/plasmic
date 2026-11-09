import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { ComponentRow } from "@/wab/client/components/sidebar/ComponentRow";
import LeftComponentsPanel from "@/wab/client/components/sidebar/LeftComponentsPanel";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Matcher } from "@/wab/client/components/view-common";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { createStore } from "zustand/vanilla";

const current = vi.hoisted(() => ({ studio: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => current.studio }));
vi.mock("@/wab/client/studio-ctx/ui/studio-ui-actions", () => ({ UiActionsOverlay: () => null, useModelUiActionHandler: () => undefined }));
vi.mock("@/wab/client/components/studio/add-drawer/DraggableInsertable", () => ({ DraggableInsertable: ({ children }) => <>{children}</> }));
vi.mock("@/wab/client/components/comments/CommentIndicatorIcon", () => ({ default: ({ commentCount }) => <span>{commentCount} comments</span> }));
vi.mock("@/wab/client/components/RowItem", () => ({ default: ({ children, icon, onClick, menu }) => (
  <div><button aria-label="Edit selected component" onClick={onClick}>{icon}<span data-testid="row-label">{children}</span></button><div>{menu()}</div></div>
) }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftComponentsPanel", () => ({
  PlasmicLeftComponentsPanel: ({ content, newComponentButton }) => <section>{!newComponentButton.render && <button onClick={newComponentButton.onClick}>New component</button>}{content}</section>,
}));
vi.mock("@/wab/client/components/grouping/VirtualTree", async () => {
  const ReactModule = await import("react");
  const names = (nodes) => nodes.flatMap((node) => node.type === "component" ? [node.component.name] : names(node.items));
  return { getFolderKeyChanges: () => new Map(),
    useTreeData: () => ({ nodeData: {}, renameGroup: () => undefined, expandAll: () => undefined, collapseAll: () => undefined, expandTo: () => undefined }),
    VirtualTree: ReactModule.forwardRef(({ rootNodes }: any, _ref) => <output>{names(rootNodes).join(", ")}</output>),
  };
});

const disposals: (() => void)[] = [];
afterEach(() => { cleanup(); disposals.splice(0).forEach((dispose) => dispose()); });
function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Folder/Badge", type: ComponentType.Plain });
  const models = new ModelSnapshots(), arenaState = new StudioArenaState({site, modelSnapshots: models}), overlayState = new StudioOverlayState();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  const ui = createStudioUiEnvironmentFixture();
  const listeners = new Set<() => void>(), modelListeners = new Set<() => void>();
  const studio = { site, modelSnapshots: models, arenaState, subscribeModelChanges: (listener: () => void) => { modelListeners.add(listener); return () => {modelListeners.delete(listener);}; }, ...ui, overlayState,
    commentsCtx: { store: createStore(() => ({ commentStatsByComponent: new Map([[component.uuid, { commentCount: 2, replyCount: 0 }]]) })) },
    appCtx: { selfInfo: { email: "user@example.com" }, appConfig: DEVFLAGS,
      subscribeUiEnvironmentInputs: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } },
    projectDependencyManager: { getNiceDepName: (dep) => dep.name }, currentArena: null,
    change: async (fn: () => unknown) => fn(), changeUnsafe: async (fn: () => void) => edit(fn),
    switchToComponentArena: vi.fn(), siteOps: () => ({ createFrameForNewComponent: vi.fn() }),
  };
  current.studio = studio;
  disposals.push(() => { arenaState.dispose(); overlayState.dispose(); models.dispose(); recorder.dispose(); });
  return { component, site, studio, edit, overlayState };
}

it("updates row labels, default markers, comments and permission-gated actions from native inputs", async () => {
  const f = fixture();
  render(<ComponentRow component={f.component} matcher={new Matcher("")} indentMultiplier={0} />);
  const label = screen.getByTestId("row-label");
  expect(label.textContent).toBe("Badge");
  expect(label.querySelector("strong")).toBeNull();
  expect(screen.queryByText("2 comments")).toBeNull();
  expect(screen.getByText("Rename")).toBeTruthy();
  act(() => { f.edit(() => { f.component.name = "Folder/Tag"; f.site.defaultComponents.button = f.component; }); });
  expect(label.textContent).toBe("Tag");
  expect(within(label).getByText("Tag").tagName).toBe("STRONG");
  act(() => { f.overlayState.commentsPanel = true; });
  expect(screen.getByText("2 comments")).toBeTruthy();
  act(() => { f.studio.uiEnvironment.store.setState((state) => ({ leftTabPermissions: { ...state.leftTabPermissions, components: "readable" } })); });
  expect(screen.queryByText("Rename")).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Edit selected component" })); });
  expect(f.studio.switchToComponentArena).toHaveBeenCalledWith(f.component);
});

it("rebuilds component folders after a committed rename and follows native panel permissions", () => {
  const f = fixture();
  render(<LeftComponentsPanel />);
  expect(screen.getByRole("status").textContent).toBe("Folder/Badge");
  expect(screen.getByRole("button", { name: "New component" })).toBeTruthy();
  act(() => { f.edit(() => { f.component.name = "Other/Tag"; }); });
  expect(screen.getByRole("status").textContent).toBe("Other/Tag");
  act(() => { f.studio.uiEnvironment.store.setState((state) => ({ leftTabPermissions: { ...state.leftTabPermissions, components: "readable" } })); });
  expect(screen.queryByRole("button", { name: "New component" })).toBeNull();
});
