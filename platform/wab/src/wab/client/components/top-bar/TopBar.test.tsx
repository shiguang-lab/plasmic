import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx, providesPreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { TopBar } from "@/wab/client/components/top-bar/TopBar";
import { TopBarLoading } from "@/wab/client/components/top-bar/TopBarLoading";
import { providesAppCtx } from "@/wab/client/contexts/AppContexts";
import { providesStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (message: string) => message }),
}));

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
});

function expectNoTopRightLegacyMenus(container: HTMLElement) {
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Redo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  expect(container.querySelector("#view-menu")).toBeNull();
  expect(container.querySelector(".editor-history-controls")).toBeNull();

  const primaryActions = container.querySelector(".editor-primary-actions");
  expect(primaryActions).toBeTruthy();
  const firstChild = primaryActions!.firstElementChild;
  expect(firstChild).toBeTruthy();
  expect(firstChild!.classList.contains("editor-action-divider")).toBe(false);
  expect(firstChild).toBe(screen.getByRole("button", { name: "Comments" }));
  expect(primaryActions!.querySelectorAll(".editor-action-divider")).toHaveLength(2);
}

it("omits top-right undo/redo and view controls while keeping remaining dividers in TopBarLoading", () => {
  const history = createMemoryHistory();
  const { container } = render(
    <HistoryProvider history={history}>
      <TopBarLoading projectName="Test Project" />
    </HistoryProvider>,
  );
  expectNoTopRightLegacyMenus(container);
});

function createTopFrameApi() {
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.getCurrentTeam.mockResolvedValue(undefined);
  topFrameApi.canEditProjectUiConfig.mockResolvedValue(false);
  topFrameApi.setDesktopTitleBarDragRegions.mockResolvedValue(undefined);
  topFrameApi.openDesktopBrowser.mockResolvedValue(undefined);
  topFrameApi.componentReuse.mockResolvedValue({ available: false } as any);
  return topFrameApi;
}

it("omits top-right undo/redo and view controls while keeping remaining dividers in TopBar", async () => {
  const site = createSite();
  const { appCtx, studioCtx } = fakeStudioCtx({ site });
  appCtx.topFrameApi = createTopFrameApi();
  const previewCtx = new PreviewCtx(
    { history: appCtx.history } as unknown as HostFrameCtx,
    studioCtx,
  );
  const { container, unmount } = render(
    <HistoryProvider history={appCtx.history}>
      {providesAppCtx(appCtx)(
        providesStudioCtx(studioCtx)(
          providesPreviewCtx(previewCtx)(<TopBar />),
        ),
      )}
    </HistoryProvider>,
  );

  try {
    expectNoTopRightLegacyMenus(container);
  } finally {
    unmount();
    previewCtx.dispose();
    studioCtx.dispose();
  }
});

it.each([undefined, "1.0.0"])(
  "shows the save indicator only in the template draft (published version %s)",
  (publishedTemplateVersion) => {
    const { appCtx, studioCtx } = fakeStudioCtx({
      siteInfo: { isTemplate: true, publishedTemplateVersion },
    });
    appCtx.topFrameApi = createTopFrameApi();
    const previewCtx = new PreviewCtx(
      { history: appCtx.history } as unknown as HostFrameCtx,
      studioCtx,
    );
    const { container, unmount } = render(
      <HistoryProvider history={appCtx.history}>
        {providesAppCtx(appCtx)(
          providesStudioCtx(studioCtx)(providesPreviewCtx(previewCtx)(<TopBar />)),
        )}
      </HistoryProvider>,
    );
    try {
      expect(container.querySelectorAll("[data-save-state]")).toHaveLength(
        publishedTemplateVersion ? 0 : 1,
      );
    } finally {
      unmount();
      previewCtx.dispose();
      studioCtx.dispose();
    }
  },
);

it("places Desktop web import immediately before Publish and triggers openDesktopBrowser", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  const site = createSite();
  const { appCtx, studioCtx } = fakeStudioCtx({ site });
  const topFrameApi = createTopFrameApi();
  appCtx.topFrameApi = topFrameApi;
  const previewCtx = new PreviewCtx(
    { history: appCtx.history } as unknown as HostFrameCtx,
    studioCtx,
  );
  const { container, unmount } = render(
    <HistoryProvider history={appCtx.history}>
      {providesAppCtx(appCtx)(
        providesStudioCtx(studioCtx)(
          providesPreviewCtx(previewCtx)(<TopBar />),
        ),
      )}
    </HistoryProvider>,
  );

  try {
    const button = container.querySelector(
      '[data-test-id="import-from-web-button"]',
    );
    expect(button).toBeTruthy();
    expect(button?.nextElementSibling).toBe(
      screen.getByRole("button", { name: "Publish" }).closest(".editor-publish-wrapper"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Import from the web" }),
    );
    expect(topFrameApi.openDesktopBrowser).toHaveBeenCalledOnce();
  } finally {
    vi.restoreAllMocks();
    unmount();
    previewCtx.dispose();
    studioCtx.dispose();
  }
});

it("keeps share and configuration items in project menu without redundant project lifecycle or import/export entries", async () => {
  const site = createSite();
  const { appCtx, studioCtx } = fakeStudioCtx({ site });
  appCtx.topFrameApi = createTopFrameApi();
  const previewCtx = new PreviewCtx(
    { history: appCtx.history } as unknown as HostFrameCtx,
    studioCtx,
  );
  const { container, unmount } = render(
    <HistoryProvider history={appCtx.history}>
      {providesAppCtx(appCtx)(
        providesStudioCtx(studioCtx)(
          providesPreviewCtx(previewCtx)(<TopBar />),
        ),
      )}
    </HistoryProvider>,
  );

  try {
    fireEvent.click(container.querySelector('[data-test-id="project-menu-btn"]')!);
    expect(await screen.findByText("Share project")).toBeTruthy();
    expect(screen.getByText("Configure custom app host")).toBeTruthy();
    expect(screen.queryByText("Rename project")).toBeNull();
    expect(screen.queryByText("Duplicate project")).toBeNull();
    expect(screen.queryByText("Import .plasmic")).toBeNull();
    expect(screen.queryByText("Export .plasmic")).toBeNull();
    expect(screen.queryByText("Import from Figma")).toBeNull();
    expect(screen.queryByText("Import from Pen")).toBeNull();
  } finally {
    vi.restoreAllMocks();
    unmount();
    previewCtx.dispose();
    studioCtx.dispose();
  }
});
