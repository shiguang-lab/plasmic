import { PublishButton } from "@/wab/client/components/top-bar/PublishButton";
import { setLanguagePreference } from "@/wab/client/i18n";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { createStore } from "zustand/vanilla";
const state = vi.hoisted(() => ({
  studio: undefined as any,
  setShowPublishModal: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => state.studio,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => state.studio.appCtx,
  useTopFrameApi: () => ({ setShowPublishModal: state.setShowPublishModal }),
}));
vi.mock("antd", async (original) => ({
  ...(await original<typeof import("antd")>()),
  message: { success: state.success, error: state.error },
}));
beforeEach(async () => {
  await setLanguagePreference("en");
  state.studio = {
    siteInfo: { id: "template", isTemplate: true },
    projectMetadataStore: createStore(() => ({ id: "template", name: "Template" })),
    versionHistory: {
      store: createStore(() => ({ releases: [], currentRevisionNum: 1 })),
    },
    uiEnvironment: { store: createStore(() => ({ branchId: null })) },
    save: vi.fn().mockResolvedValue(undefined),
    hasUnsavedChanges: () => false,
    appCtx: { api: { publishDesignTemplate: vi.fn().mockResolvedValue({}) } },
  };
  state.success.mockReset();
  state.error.mockReset();
  state.setShowPublishModal.mockReset();
});
afterEach(cleanup);
it("uses the standard Publish icon for templates and saves before publishing", async () => {
  render(<PublishButton enable />);
  const publish = screen.getByRole("button", { name: "Publish" });
  expect(publish.id).toBe("topbar-publish-btn");
  expect(publish.querySelector("svg")).toBeTruthy();
  expect(publish.textContent).toBe("");
  fireEvent.click(publish);
  await waitFor(() => expect(state.success).toHaveBeenCalled());
  expect(state.studio.save.mock.invocationCallOrder[0]).toBeLessThan(
    state.studio.appCtx.api.publishDesignTemplate.mock.invocationCallOrder[0],
  );
  expect(state.studio.appCtx.api.publishDesignTemplate).toHaveBeenCalledWith(
    "template",
  );
  expect(state.setShowPublishModal).not.toHaveBeenCalled();
});
it("does not publish stale saved content when saving fails or remains incomplete", async () => {
  state.studio.hasUnsavedChanges = () => true;
  render(<PublishButton enable />);
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(state.error).toHaveBeenCalled());
  expect(state.studio.appCtx.api.publishDesignTemplate).not.toHaveBeenCalled();
});
