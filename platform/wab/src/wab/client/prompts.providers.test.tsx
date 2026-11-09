import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { setLanguagePreference } from "@/wab/client/i18n";
import { promptPageTemplate } from "@/wab/client/prompts";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent, mkPageMeta } from "@/wab/shared/core/components";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

beforeEach(async () => {
  await setLanguagePreference("en");
});
afterEach(() => vi.restoreAllMocks());

it.each(["submit", "cancel"] as const)("opens the actual page prompt in its independent root and handles %s", async (action) => {
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
  const { studioCtx } = fakeStudioCtx({ topFrameApi, devFlagOverrides: { insertableTemplates: undefined } });
  let answer: ReturnType<typeof promptPageTemplate> | undefined;
  try {
    await act(async () => { answer = promptPageTemplate(studioCtx, "Customers/"); });
    const name = await screen.findByRole("textbox");
    const surface = ensure(name.closest(".ant-modal-container"), "Native modal surface");
    expect(getComputedStyle(surface).pointerEvents).toBe("auto");
    expect((name as HTMLInputElement).value).toBe("Customers/");
    if (action === "submit") {
      fireEvent.change(name, { target: { value: "Customers/List" } });
      await act(async () => { fireEvent.submit(ensure(name.closest("form"), "Page creation form")); });
      await expect(answer).resolves.toEqual({ name: "Customers/List", type: "blank" });
    } else {
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
      await expect(answer).resolves.toBeUndefined();
    }
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  } finally {
    const cancel = screen.queryByRole("button", { name: "Cancel" });
    if (cancel) { await act(async () => { fireEvent.click(cancel); }); }
    studioCtx.dispose();
  }
});

it("uses the page prompt's AppCtx to preview a template in the native window", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("PlasmicDesktop/darwin");
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
  const template = mkComponent({ name: "Template", type: ComponentType.Page, tplTree: mkTplTag("div") });
  template.pageMeta = mkPageMeta({ path: "/template" });
  const { studioCtx, api } = fakeStudioCtx({
    topFrameApi,
    devFlagOverrides: {
      insertableTemplates: {
        type: "insertable-templates-group", name: "Templates", items: [{
          type: "insertable-templates-group", name: "Pages", isPageTemplatesGroup: true, items: [{
            type: "insertable-templates-item", projectId: "template-project", componentName: "Template", displayName: "Audit template",
          }],
        }],
      },
    },
  });
  vi.spyOn(studioCtx.projectDependencyManager, "fetchInsertableTemplate").mockResolvedValue(undefined);
  vi.spyOn(studioCtx.projectDependencyManager, "getInsertableTemplate").mockReturnValue({ component: template, site: studioCtx.site });
  api.createPresentation.mockResolvedValue({ code: "PreviewCode", projectId: "template-project" as ProjectId });
  api.getStudioUrl.mockResolvedValue("http://localhost:3003");
  try {
    await act(async () => { void promptPageTemplate(studioCtx); });
    const item = await screen.findByRole("button", { name: /Audit template/ });
    await act(async () => { fireEvent.click(ensure(item.querySelector("svg"), "Template preview control")); });
    await waitFor(() => expect(topFrameApi.openDesktopPreview).toHaveBeenCalledWith("http://localhost:3003/d/PreviewCode#/template"));
    expect(api.createPresentation).toHaveBeenCalledWith("template-project");
  } finally {
    const cancel = screen.queryByRole("button", { name: "Cancel" });
    if (cancel) { await act(async () => { fireEvent.click(cancel); }); }
    studioCtx.dispose();
  }
});
