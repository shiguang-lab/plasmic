import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { UserManagedFontsPanel } from "@/wab/client/components/sidebar/UserManagedFonts";
import { FontManager } from "@/wab/client/fonts";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { ProjectDependency, Site } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { notification } from "antd";
import $ from "jquery";
import React from "react";

const context = vi.hoisted(() => ({ current: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => context.current,
}));

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return;
      }
      unobserve() {
        return;
      }
      disconnect() {
        return;
      }
    },
  );
});
let dispose: () => void;
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  dispose?.();
  document.body.innerHTML = "";
});

interface FontListOptions {
  own?: string[];
  imported?: string[];
  fontsAccess?: "hidden" | "readable" | "writable";
}

function mkDependency(site: Site, suffix: string) {
  return new ProjectDependency({
    name: `Dependency ${suffix}`,
    pkgId: `pkg-${suffix}`,
    projectId: `project-${suffix}`,
    version: "0.0.1",
    uuid: `dep-${suffix}`,
    site,
  });
}

async function setup(
  hostFamilies: string[] = [],
  usedFont?: string,
  fontLists: FontListOptions = {},
) {
  // jsdom has no font layout; simulate the existing Studio width probe.
  document.body.innerHTML = '<span class="fontTester"></span>';
  vi.spyOn($.fn, "width").mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("Local Font") ? 200 : 100;
  } as any);
  const site = createSite();
  if (usedFont) {
    ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
      usedFont;
  }
  const ownFonts = fontLists.own ?? [
    "Host Font",
    "Missing Font",
    "Local Font",
  ];
  site.userManagedFonts.push(...ownFonts);
  if (fontLists.imported?.length) {
    site.projectDependencies.push(
      mkDependency(
        createSite({ userManagedFonts: [...fontLists.imported] }),
        "initial",
      ),
    );
  }
  const manager = new FontManager(site);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const environment = createStudioUiEnvironmentFixture();
  environment.uiEnvironment.store.setState((previous) => ({
    ...previous,
    leftTabPermissions: Object.freeze({
      ...previous.leftTabPermissions,
      fonts: fontLists.fontsAccess ?? "readable",
    }),
  }));
  const iframe = document.body.appendChild(document.createElement("iframe"));
  const hostWindow = ensure(iframe.contentWindow, "host window");
  const host = hostWindow.document;
  const events = new EventTarget();
  const available = new Set(hostFamilies);
  const loadFace = vi.fn(async () => ({}));
  const load = vi.fn(async () => []);
  let faceStatus = "unloaded";

  Object.defineProperty(host, "fonts", {
    value: {
      load,
      forEach: (
        visit: (face: {
          family: string;
          status: string;
          unicodeRange: string;
          load: typeof loadFace;
        }) => void,
      ) =>
        available.forEach((family) => {
          for (const unicodeRange of ["U+0041-005A", "U+0061-007A"]) {
            visit({
              family: `"${family}"`,
              status: faceStatus,
              unicodeRange,
              load: loadFace,
            });
          }
        }),
      ready: Promise.resolve(),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  });
  context.current = {
    site,
    fontManager: manager,
    uiEnvironment: environment.uiEnvironment,
  };
  dispose = manager.observeHostFonts(hostWindow);
  render(<UserManagedFontsPanel />);
  if (ownFonts.includes("Local Font")) {
    await waitFor(() =>
      expect(manager.isUserManagedFontInstalled("Local Font")).toBe(true),
    );
  }
  return {
    manager,
    available,
    environment,
    events,
    load,
    loadFace,
    host,
    setFaceStatus: (status: string) => (faceStatus = status),
    site,
  };
}

function warning(font: string) {
  return ensure(screen.getByText(font).parentElement, "font row").querySelector(
    "svg",
  );
}

it("recognizes a subsetted host-provided font without loading unused faces", async () => {
  const { manager, load, loadFace } = await setup(["Host Font"]);
  await waitFor(() =>
    expect(manager.isUserManagedFontInstalled("Host Font")).toBe(true),
  );
  expect(load).not.toHaveBeenCalled();
  expect(loadFace).not.toHaveBeenCalled();
  expect(warning("Host Font")).toBeNull();
});

it("does not warn about an available host font absent from the user font list", async () => {
  const warn = vi.spyOn(notification, "warning");
  const { manager } = await setup(["Custom Host Font"], "Custom Host Font");
  manager.installAllUsedFonts([]);
  manager.installAllUsedFonts([]);

  expect(manager.missingUsedFonts()).not.toContain("Custom Host Font");
  expect(warn).not.toHaveBeenCalled();
});

it("updates the open panel when a host font becomes available", async () => {
  const { available, events } = await setup();
  expect(warning("Host Font")).not.toBeNull();
  await act(async () => {
    available.add("Host Font");
    events.dispatchEvent(new Event("loadingdone"));
  });
  await waitFor(() => expect(warning("Host Font")).toBeNull());
  expect(warning("Missing Font")).not.toBeNull();
});

it("updates the open panel when a host font is declared after registration without loading", async () => {
  const { available, host, load, loadFace } = await setup();
  expect(warning("Host Font")).not.toBeNull();
  await act(async () => {
    available.add("Host Font");
    const style = host.createElement("style");
    style.textContent =
      '@font-face { font-family: "Host Font"; src: url(host.woff) }';
    host.head.append(style);
  });
  await waitFor(() => expect(warning("Host Font")).toBeNull());
  expect(load).not.toHaveBeenCalled();
  expect(loadFace).not.toHaveBeenCalled();
  expect(warning("Missing Font")).not.toBeNull();
});

it("updates the open panel when a host stylesheet finishes loading", async () => {
  const { available, host } = await setup();
  const link = host.createElement("link");
  link.rel = "stylesheet";
  await act(async () => {
    host.head.append(link);
  });
  expect(warning("Host Font")).not.toBeNull();
  await act(async () => {
    available.add("Host Font");
    link.dispatchEvent(new Event("load"));
  });
  await waitFor(() => expect(warning("Host Font")).toBeNull());
});

it("preserves warnings for missing and local fonts correctly", async () => {
  await setup();
  expect(warning("Missing Font")).not.toBeNull();
  expect(warning("Local Font")).toBeNull();
});

it("updates the open panel when a host font is declared or removed through the CSSOM", async () => {
  const { available, host } = await setup();
  const style = host.createElement("style");
  await act(async () => {
    host.head.append(style);
  });
  expect(warning("Host Font")).not.toBeNull();
  await act(async () => {
    available.add("Host Font");
    ensure(style.sheet, "sheet").insertRule(
      '@font-face { font-family: "Host Font"; src: url(host.woff) }',
    );
  });
  await waitFor(() => expect(warning("Host Font")).toBeNull());
  await act(async () => {
    available.delete("Host Font");
    ensure(style.sheet, "sheet").deleteRule(0);
  });
  await waitFor(() => expect(warning("Host Font")).not.toBeNull());
});

it("removes host availability when observation stops", async () => {
  const { manager } = await setup(["Host Font"]);
  await waitFor(() => expect(warning("Host Font")).toBeNull());
  act(() => dispose());
  expect(manager.isUserManagedFontInstalled("Host Font")).toBe(false);
  expect(warning("Host Font")).not.toBeNull();
});

it("checks fonts added after the host was registered", async () => {
  const { site, available, manager } = await setup();
  await act(async () => {
    available.add("New Font");
    site.userManagedFonts.push("New Font");
    manager.syncSite(site);
    await manager.addUserManagedFont("New Font");
  });
  await waitFor(() => expect(warning("New Font")).toBeNull());
});

it("keeps the warning when a matching host face has a load error", async () => {
  const { available, events, loadFace, setFaceStatus } = await setup();
  await act(async () => {
    available.add("Host Font");
    setFaceStatus("error");
    events.dispatchEvent(new Event("loadingerror"));
  });
  expect(loadFace).not.toHaveBeenCalled();
  expect(warning("Host Font")).not.toBeNull();
});

it("updates own font rows after a same-length committed edit", async () => {
  const { site, manager } = await setup();
  expect(screen.getByText("Missing Font")).toBeTruthy();

  await act(async () => {
    site.userManagedFonts.splice(1, 1, "Other Missing Font");
    manager.syncSite(site);
  });

  expect(screen.queryByText("Missing Font")).toBeNull();
  expect(screen.getByText("Other Missing Font")).toBeTruthy();
  expect(warning("Other Missing Font")).not.toBeNull();
});

it("updates imported rows when a dependency is replaced and removed", async () => {
  const { site, manager } = await setup([], undefined, {
    own: ["Own Font"],
    imported: ["Imported Font", "Own Font", "Imported Font"],
  });
  expect(screen.getByText("Imported Font")).toBeTruthy();
  expect(screen.getAllByText("(imported)")).toHaveLength(1);

  await act(async () => {
    site.projectDependencies[0] = mkDependency(
      createSite({
        userManagedFonts: ["Replacement Font", "Own Font", "Replacement Font"],
      }),
      "replacement",
    );
    manager.syncSite(site);
  });

  expect(screen.queryByText("Imported Font")).toBeNull();
  expect(screen.getByText("Replacement Font")).toBeTruthy();
  expect(screen.getAllByText("(imported)")).toHaveLength(1);

  await act(async () => {
    site.projectDependencies.splice(0, 1);
    manager.syncSite(site);
  });

  expect(screen.queryByText("Replacement Font")).toBeNull();
  expect(screen.queryByText("(imported)")).toBeNull();
});

it("updates read-only actions from the permission store without parent renders", async () => {
  const { environment } = await setup();
  cleanup();

  const parentRender = vi.fn();
  function Parent() {
    parentRender();
    return <UserManagedFontsPanel />;
  }
  render(<Parent />);
  expect(screen.queryByText("New font")).toBeNull();

  parentRender.mockClear();
  await act(async () => {
    environment.uiEnvironment.store.setState((previous) => ({
      ...previous,
      leftTabPermissions: Object.freeze({
        ...previous.leftTabPermissions,
        fonts: "writable",
      }),
    }));
  });

  expect(screen.getByText("New font")).toBeTruthy();
  expect(parentRender).not.toHaveBeenCalled();

  await act(async () => {
    environment.uiEnvironment.store.setState((previous) => ({
      ...previous,
      leftTabPermissions: Object.freeze({
        ...previous.leftTabPermissions,
        fonts: "readable",
      }),
    }));
  });

  expect(screen.queryByText("New font")).toBeNull();
  expect(parentRender).not.toHaveBeenCalled();
});

it("stops updating font rows after the owner is disposed", async () => {
  const { site, manager } = await setup();
  const settled = manager.store.getState();
  act(() => manager.dispose());

  await act(async () => {
    site.userManagedFonts.push("After Dispose");
    manager.syncSite(site);
  });

  expect(manager.store.getState()).toBe(settled);
  expect(screen.queryByText("After Dispose")).toBeNull();
});
