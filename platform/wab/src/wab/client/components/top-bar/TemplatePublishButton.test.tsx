import { TemplatePublishButton } from "@/wab/client/components/top-bar/TemplatePublishButton";
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
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => state.studio,
}));
vi.mock("antd", async (original) => ({
  ...(await original<typeof import("antd")>()),
  message: { success: state.success, error: state.error },
}));
beforeEach(async () => {
  await setLanguagePreference("en");
  state.studio = {
    siteInfo: { id: "template" },
    uiEnvironment: { store: createStore(() => ({ branchId: null })) },
    save: vi.fn().mockResolvedValue(undefined),
    hasUnsavedChanges: () => false,
    appCtx: { api: { publishDesignTemplate: vi.fn().mockResolvedValue({}) } },
  };
  state.success.mockReset();
  state.error.mockReset();
});
afterEach(cleanup);
it("saves the current canvas before publishing the reference", async () => {
  render(<TemplatePublishButton />);
  fireEvent.click(screen.getByRole("button", { name: "Publish template" }));
  await waitFor(() => expect(state.success).toHaveBeenCalled());
  expect(state.studio.save.mock.invocationCallOrder[0]).toBeLessThan(
    state.studio.appCtx.api.publishDesignTemplate.mock.invocationCallOrder[0],
  );
  expect(state.studio.appCtx.api.publishDesignTemplate).toHaveBeenCalledWith(
    "template",
  );
});
it("does not publish stale saved content when saving fails or remains incomplete", async () => {
  state.studio.hasUnsavedChanges = () => true;
  render(<TemplatePublishButton />);
  fireEvent.click(screen.getByRole("button", { name: "Publish template" }));
  await waitFor(() => expect(state.error).toHaveBeenCalled());
  expect(state.studio.appCtx.api.publishDesignTemplate).not.toHaveBeenCalled();
});
