import { createAddPageTemplate } from "@/wab/client/components/studio/add-drawer/AddDrawer";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { InsertableTemplatesItem } from "@/wab/shared/devflags";
import { InsertableTemplateComponentExtraInfo } from "@/wab/shared/insertable-templates/types";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";
const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  screen: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/wab/client/insertable-templates", async (original) => ({
  ...(await original<object>()),
  buildInsertableExtraInfo: mocks.build,
  getScreenVariantToInsertableTemplate: mocks.screen,
  replaceWithPageTemplate: mocks.replace,
}));
const meta: InsertableTemplatesItem = {
  type: "insertable-templates-item",
  projectId: "template1",
  componentName: "GroupsPage",
  displayName: "Groups",
  imageUrl: "/groups.png",
};
function fixture(withArena = true) {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const arena = ensurePageOverviewArena(mgr);
  const createFrame = vi.fn();
  const addComponent = vi.fn<StudioCtx["addComponent"]>((name) =>
    mgr.addComponent({ name, type: ComponentType.Page }),
  );
  const sc: Partial<StudioCtx> = {
    currentArena: withArena ? arena : undefined,
    canSave: () => true,
    addComponent,
    siteOps: vi.fn<StudioCtx["siteOps"]>(),
  };
  // The factory uses only this existing SiteOps operation, inside the caller's change transaction.
  const ops: Pick<
    ReturnType<StudioCtx["siteOps"]>,
    "createNewFrameForMixedArena"
  > = { createNewFrameForMixedArena: createFrame };
  (
    sc.siteOps as ReturnType<typeof vi.fn<StudioCtx["siteOps"]>>
  ).mockReturnValue(ops as ReturnType<StudioCtx["siteOps"]>);
  return { sc: sc as StudioCtx, site, arena, addComponent, createFrame };
}
afterEach(() => vi.clearAllMocks());
it("creates a Page and a matching overview artboard using the template replacement contract", () => {
  const { sc, arena, addComponent, createFrame } = fixture();
  const info = {} as InsertableTemplateComponentExtraInfo;
  const result = createAddPageTemplate(meta).factory(sc, info);
  const page = addComponent.mock.results[0].value;
  expect(addComponent).toHaveBeenCalledWith("GroupsPage", {
    type: ComponentType.Page,
    noSwitchArena: true,
  });
  expect(mocks.replace).toHaveBeenCalledWith(sc, page, info);
  expect(createFrame).toHaveBeenCalledWith(page);
  expect(result).toBe(arena);
});
it("does not create an empty page on cancelled loading or loss of edit permission", () => {
  const { sc, addComponent } = fixture();
  const item = createAddPageTemplate(meta);
  expect(item.factory(sc, undefined)).toBeUndefined();
  sc.canSave = () => false;
  expect(
    item.factory(sc, {} as InsertableTemplateComponentExtraInfo),
  ).toBeUndefined();
  expect(addComponent).not.toHaveBeenCalled();
});
it("fails missing templates before changing the model and uses the actual responsive mapping", async () => {
  const { sc, addComponent } = fixture();
  const item = createAddPageTemplate(meta);
  mocks.screen.mockResolvedValue({ screenVariant: undefined });
  mocks.build.mockResolvedValue(undefined);
  await expect(item.asyncExtraInfo?.(sc)).rejects.toThrow(
    "Page template is unavailable",
  );
  expect(mocks.build).toHaveBeenCalledWith(sc, meta, undefined);
  expect(addComponent).not.toHaveBeenCalled();
});
it("returns the created page when there is no custom arena", () => {
  const { sc, addComponent, createFrame } = fixture(false);
  const result = createAddPageTemplate(meta).factory(
    sc,
    {} as InsertableTemplateComponentExtraInfo,
  );
  expect(result).toBe(addComponent.mock.results[0].value);
  expect(createFrame).not.toHaveBeenCalled();
});
