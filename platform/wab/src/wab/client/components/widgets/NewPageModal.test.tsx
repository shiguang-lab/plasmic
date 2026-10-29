import NewPageModal from "@/wab/client/components/widgets/NewPageModal";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getTemplate: vi.fn(),
  create: vi.fn(),
  studioUrl: vi.fn(),
  openDesktopPreview: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ openDesktopPreview: mocks.openDesktopPreview }),
}));
vi.mock("@/wab/client/insertable-templates", () => ({
  getPageTemplatesGroups: () => [
    {
      name: "Templates",
      items: [
        {
          type: "insertable-templates-item",
          projectId: "library",
          componentName: "Template",
        },
      ],
    },
  ],
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_new_component/PlasmicNewComponentModal",
  () => ({
    PlasmicNewComponentModal: ({ children }) => <>{children}</>,
  }),
);
vi.mock("@/wab/client/components/widgets/NewComponentSection", () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock("@/wab/client/components/widgets/NewComponentItem", () => ({
  default: ({ controls }) => <>{controls}</>,
}));
vi.mock("@/wab/client/components/widgets/Icon", () => ({
  Icon: ({ onClick }) => <button onClick={onClick}>Preview template</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0");
  mocks.fetch.mockResolvedValue(undefined);
  mocks.getTemplate.mockReturnValue({
    component: {
      uuid: "component",
      pageMeta: {
        path: "/templates/[id]",
        params: { id: "page" },
        query: { id: "query" },
      },
    },
  });
  mocks.create.mockResolvedValue({ code: "0123456789" });
  mocks.studioUrl.mockResolvedValue("https://studio.example");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(blocked = false) {
  const preview = {
    opener: window,
    location: { replace: vi.fn() },
    close: vi.fn(),
  };
  vi.spyOn(window, "open").mockReturnValue(
    blocked ? null : (preview as unknown as Window),
  );
  render(
    <NewPageModal
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      studioCtx={
        {
          siteInfo: {},
          getCurrentUiConfig: () => ({ hideDefaultPageTemplates: true }),
          projectDependencyManager: {
            fetchInsertableTemplate: mocks.fetch,
            getInsertableTemplate: mocks.getTemplate,
          },
          appCtx: {
            api: {
              createPresentation: mocks.create,
              getStudioUrl: mocks.studioUrl,
            },
          },
        } as unknown as StudioCtx
      }
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Preview template" }));
  return preview;
}
it("reserves the window before loading and uses the Studio origin with independent route/query parameters", async () => {
  let release!: () => void;
  mocks.fetch.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const preview = setup();
  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(preview.opener).toBeNull();
  release();
  await waitFor(() =>
    expect(preview.location.replace).toHaveBeenCalledWith(
      "https://studio.example/d/0123456789#/templates/page?id=query",
    ),
  );
  expect(mocks.create).toHaveBeenCalledWith("library");
  expect(preview.close).not.toHaveBeenCalled();
});
it("keeps a non-page component target outside the business route", async () => {
  mocks.getTemplate.mockReturnValue({ component: { uuid: "component" } });
  const preview = setup();
  await waitFor(() =>
    expect(preview.location.replace).toHaveBeenCalledWith(
      "https://studio.example/d/0123456789?component=component#/",
    ),
  );
});
it("closes the reserved window if the template is missing", async () => {
  mocks.getTemplate.mockReturnValue(undefined);
  const preview = setup();
  await waitFor(() => expect(preview.close).toHaveBeenCalledOnce());
  expect(mocks.create).not.toHaveBeenCalled();
});
it("does not load or allocate a code when the browser blocks the window", () => {
  setup(true);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("uses the native browser handoff for Desktop without opening an intercepted blank window", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  setup();
  await waitFor(() =>
    expect(mocks.openDesktopPreview).toHaveBeenCalledWith(
      "https://studio.example/d/0123456789#/templates/page?id=query",
    ),
  );
  expect(window.open).not.toHaveBeenCalled();
});
