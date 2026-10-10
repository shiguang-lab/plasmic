import { NavigationDropdownContext } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { NavigationArenaRow } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationRows";
import { Matcher } from "@/wab/client/components/view-common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ studioCtx: {} as any }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => fixture.studioCtx,
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu",
  () => ({ ArenaContextMenu: () => null }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown",
  async () => {
    const { createContext } = await import("react");
    return { NavigationDropdownContext: createContext(undefined) };
  },
);
afterEach(cleanup);

it("opens another page's settings without invoking row navigation or changing the current arena", () => {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const currentPage = mgr.addComponent({
    name: "Page1",
    type: ComponentType.Page,
  });
  const targetPage = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  });
  const currentArena = ensure(
    site.pageArenas.find((a) => a.component === currentPage),
    "Current page arena",
  );
  const targetArena = ensure(
    site.pageArenas.find((a) => a.component === targetPage),
    "Target page arena",
  );
  const navigate = vi.fn();
  fixture.studioCtx = {
    currentArena,
    commentsCtx: {
      computedData: () => ({ commentStatsByComponent: new Map() }),
    },
    changeUnsafe: (fn: () => void) => fn(),
  };
  render(
    <NavigationDropdownContext.Provider value={{ onClose: vi.fn() }}>
      <NavigationArenaRow
        arena={targetArena}
        matcher={new Matcher("")}
        indentMultiplier={0}
        onClick={navigate}
      />
    </NavigationDropdownContext.Provider>,
  );
  fireEvent.mouseEnter(screen.getByText("Page2"));
  fireEvent.click(screen.getByRole("button", { name: "Page settings" }));
  expect(fixture.studioCtx.pageSettingsPage).toBe(targetPage);
  expect(fixture.studioCtx.pageSettingsOpen).toBe(true);
  expect(fixture.studioCtx.currentArena).toBe(currentArena);
  expect(navigate).not.toHaveBeenCalled();
});
