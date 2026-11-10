import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { waitFor } from "@testing-library/react";

describe.each(["page", "component", "artboard"] as const)(
  "%s history",
  (kind) => {
    it.each(["redo creation", "undo deletion"] as const)(
      "publishes canvas membership before waiting for the restored view: %s",
      async (operation) => {
        vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
        const { studioCtx: studio } = fakeStudioCtx();
        try {
          await waitFor(() => expect(studio.initialRouteReady).toBe(true));
          const overview =
            kind === "artboard"
              ? await studio.changeUnsafe(() => studio.addArena("Overview"))
              : undefined;
          const reusable = overview
            ? await studio.changeUnsafe(() =>
                studio.addComponent("Existing component", {
                  type: ComponentType.Plain,
                  noSwitchArena: true,
                }),
              )
            : undefined;

          studio.createViewStateUndoRecord();
          const models = studio.modelSnapshots;
          const membership = overview
            ? models.field(overview, "children")
            : models.field(
                studio.site,
                kind === "page" ? "pageArenas" : "componentArenas",
              );
          const before = membership.getState();
          const component =
            reusable ??
            (await studio.changeUnsafe(() =>
              studio.addComponent("Restored design", {
                type:
                  kind === "page" ? ComponentType.Page : ComponentType.Plain,
              }),
            ));
          const arena =
            overview ??
            ensure(
              getDedicatedArena(studio.site, component),
              "Dedicated arena",
            );
          const frame = overview
            ? await studio.changeUnsafe(() =>
                studio.siteOps().createNewFrameForMixedArena(component),
              )
            : ensure(getArenaFrames(arena)[0], "Dedicated frame");
          const member = overview ? models.ref(frame) : models.ref(arena);
          const view = ensure(
            studio.tryGetViewCtxForFrame(frame),
            "Original view",
          );
          view.setStudioFocusByTpl(component.tplTree);
          studio.createViewStateUndoRecord();

          if (operation === "undo deletion") {
            if (overview) {
              await studio.siteOps().removeArenaFrame(frame);
            } else {
              await studio.changeUnsafe(() =>
                studio.siteOps().tryRemoveComponent(component),
              );
            }
          } else {
            await studio.undo();
          }
          expect(membership.getState()).toEqual(before);
          expect(studio.site.components.includes(component)).toBe(!!overview);
          expect(view.isDisposed).toBe(true);

          const getView = studio.tryGetViewCtxForFrame.bind(studio);
          let mounted = false;
          // The fake creates views on demand. Real canvases mount only after
          // React receives the arena list or the mixed arena's children.
          const lookup = vi
            .spyOn(studio, "tryGetViewCtxForFrame")
            .mockImplementation((target) =>
              target === frame && !mounted ? undefined : getView(target),
            );
          const wait = vi
            .spyOn(studio, "awaitViewCtxForFrame")
            .mockImplementation(async (target) => {
              expect(membership.getState()).toContain(member);
              expect(studio.arenaState.store.getState().frames).toContain(
                models.ref(frame),
              );
              expect(studio.hasUnsavedChanges()).toBe(true);
              mounted = true;
              return ensure(getView(target), "Restored view");
            });

          await (operation === "undo deletion" ? studio.undo() : studio.redo());
          expect(wait).toHaveBeenCalledExactlyOnceWith(frame);
          wait.mockRestore();
          lookup.mockRestore();

          const restored = ensure(
            studio.tryGetViewCtxForFrame(frame),
            "Recreated view",
          );
          expect(restored).not.toBe(view);
          expect(restored.isDisposed).toBe(false);
          expect(studio.currentArena).toBe(arena);
          expect(studio.focusedViewCtx()).toBe(restored);
          expect(restored.focusedTpl()).toBe(component.tplTree);
          expect(studio.hasPendingModelChanges()).toBe(false);

          const name = component.name;
          await studio.changeUnsafe(() => {
            component.name = "Still editable";
          });
          await studio.undo();
          expect(component.name).toBe(name);
          await studio.redo();
          expect(component.name).toBe("Still editable");
        } finally {
          studio.dispose();
        }
      },
    );
  },
);
