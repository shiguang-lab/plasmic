import { ComponentArenaLayout } from "@/wab/client/components/studio/arenas/ComponentArenaLayout";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type { ArenaFrameRow } from "@/wab/shared/model/classes";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { createStore } from "zustand/vanilla";

const captured = vi.hoisted(() => ({ click: undefined as (() => void) | undefined }));
vi.mock("@/wab/client/studio-ctx/viewport-state", () => ({ useCanvasZoom: () => 1 }));
vi.mock("@/wab/client/studio-ctx/frame-heights", () => ({ useFrameHeight: () => 100 }));
vi.mock("@/wab/client/studio-ctx/variant-controller-inputs", () => ({ useVariantsController: () => undefined }));
vi.mock("@/wab/client/hooks/useResponsiveBreakpoints", () => ({ useResponsiveBreakpoints: () => ({ orderedScreenVariants: [] }) }));
vi.mock("@/wab/client/components/variants/VariantsController", () => ({ makeVariantsController: () => undefined }));
vi.mock("@/wab/client/i18n", () => ({ useI18n: () => ({ t: (value: string) => value }), getUiLocale: () => "en" }));
vi.mock("@/wab/client/components/studio/arenas/GhostFrame", () => ({ GhostFrame: ({ onClick }: { onClick?: () => void }) => { captured.click = onClick; return null; } }));
vi.mock("@/wab/client/components/studio/arenas/GridFramesLayout", () => ({
  GridFramesLayout: ({ grid, rowEndControls }: { grid: { rows: ArenaFrameRow[] }; rowEndControls: (row: ArenaFrameRow) => React.ReactNode }) => rowEndControls(ensure(grid.rows[0], "Base row")),
}));

it("does not run either variant creation branch from a retained retired interaction callback", async () => {
  const site = createSite();
  new TplMgr({ site }).addComponent({ type: ComponentType.Plain, name: "Interaction" });
  const arena = ensure(site.componentArenas[0], "Component arena");
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const createStyleVariant = vi.fn(), createCodeComponentVariant = vi.fn();
  const studio = {
    site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal },
    variantGroupEditingStore: createStore(() => undefined),
    projectDependencyManager: { dependencyStateStore: createStore(() => ({})) },
    changeUnsafe: async (command: () => void) => command(),
    siteOps: () => ({ createStyleVariant, createCodeComponentVariant }),
  } as unknown as StudioCtx;
  const mounted = render(<ComponentArenaLayout studioCtx={studio} arena={arena} onFrameLoad={vi.fn()} />);
  try {
    const click = ensure(captured.click, "Interaction variant callback");
    await act(async () => { click(); });
    expect(createStyleVariant).toHaveBeenCalledWith(arena.component);
    createStyleVariant.mockClear();
    act(() => lifetime.abort());
    await act(async () => { click(); });
    expect(createStyleVariant).not.toHaveBeenCalled();
    expect(createCodeComponentVariant).not.toHaveBeenCalled();
  } finally { mounted.unmount(); models.dispose(); }
});
