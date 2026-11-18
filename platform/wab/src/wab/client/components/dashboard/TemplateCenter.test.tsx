import { AntdConfigProvider } from "@/wab/client/antd-theme";
import TemplateCenter from "@/wab/client/components/dashboard/TemplateCenter";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listDesignTemplates: vi.fn(),
  createDesignTemplate: vi.fn(),
  updateDesignTemplate: vi.fn(),
  publishDesignTemplate: vi.fn(),
  uploadImageFile: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ selfInfo: { id: "user" }, api }),
}));
const metadata = {
  name: "移动端登录",
  description: "短信验证登录",
  kind: "page",
  device: "mobile",
  category: "登录",
  thumbnailUrl: "",
};
const published = {
  version: "1.0.0",
  publishedAt: "2026-11-17T00:00:00Z",
  previewUrl: "https://preview.test/s/reference",
  libraries: ["Material UI"],
};
const template = { id: "template", metadata, published };
function setup() {
  const history = createMemoryHistory({ initialEntries: ["/template-center"] });
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <HistoryProvider history={history}>
        <AntdConfigProvider productUI>
          <TemplateCenter />
        </AntdConfigProvider>
      </HistoryProvider>
    </SWRConfig>,
  );
  return history;
}
beforeEach(async () => {
  vi.resetAllMocks();
  await setLanguagePreference("en");
  api.listDesignTemplates.mockResolvedValue({
    templates: [template],
    canManage: false,
  });
});
afterEach(cleanup);
it("shows only reference actions for readers and searches templates", async () => {
  setup();
  await screen.findByText("移动端登录");
  expect(screen.queryByRole("button", { name: "New template" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Publish template" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Edit canvas" })).toBeNull();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search templates" }),
    { target: { value: "不存在" } },
  );
  expect(screen.getByText("No templates found")).toBeTruthy();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search templates" }),
    { target: { value: "短信" } },
  );
  expect(screen.getByText("移动端登录")).toBeTruthy();
});
it("opens the published Studio from the card and the draft from Edit canvas", async () => {
  api.listDesignTemplates.mockResolvedValue({
    templates: [template],
    canManage: true,
  });
  const history = setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "View published template: 移动端登录" }),
  );
  expect(history.location.pathname).toBe("/projects/template");
  expect(history.location.search).toBe("?publishedTemplate=true");
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Edit canvas" }));
  expect(history.location.pathname).toBe("/projects/template");
  expect(history.location.search).toBe("");
});
it("creates a standalone template and opens its draft canvas", async () => {
  api.listDesignTemplates.mockResolvedValue({ templates: [], canManage: true });
  api.createDesignTemplate.mockResolvedValue({
    template: { id: "new-template", metadata, published: null },
  });
  const history = setup();
  fireEvent.click(await screen.findByRole("button", { name: "New template" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "移动端登录" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create and edit" }));
  await waitFor(() =>
    expect(api.createDesignTemplate).toHaveBeenCalledWith({
      ...metadata,
      description: "",
      category: "",
    }),
  );
  expect(history.location.pathname).toBe("/projects/new-template");
});
it("refreshes the card after saving details without publishing the canvas", async () => {
  const updated = { ...metadata, name: "新模板名称" };
  api.listDesignTemplates.mockResolvedValue({
    templates: [template],
    canManage: true,
  });
  api.updateDesignTemplate.mockImplementation(async () => {
    const updatedTemplate = { ...template, metadata: updated };
    api.listDesignTemplates.mockResolvedValue({
      templates: [updatedTemplate],
      canManage: true,
    });
    return { template: updatedTemplate };
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Edit details" }),
  );
  expect(
    (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
  ).toBe(metadata.name);
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: updated.name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", {
    name: `View published template: ${updated.name}`,
  });
  expect(api.updateDesignTemplate).toHaveBeenCalledWith(
    "template",
    updated,
  );
  expect(api.publishDesignTemplate).not.toHaveBeenCalled();
});

it("distinguishes an empty collection from empty search results and resets filters", async () => {
  api.listDesignTemplates.mockResolvedValue({
    templates: [],
    canManage: false,
  });
  setup();
  await screen.findByText("No templates yet");
  expect(
    screen.queryByRole("button", { name: "Create your first template" }),
  ).toBeNull();
  cleanup();
  api.listDesignTemplates.mockResolvedValue({
    templates: [template],
    canManage: false,
  });
  setup();
  await screen.findByText("移动端登录");
  fireEvent.click(screen.getByRole("tab", { name: "Section template" }));
  expect(screen.getByText("No templates found")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show all templates" }));
  expect(screen.getByText("移动端登录")).toBeTruthy();
  expect(
    screen
      .getByRole("tab", { name: "All templates" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

async function openDetailsWithCover() {
  api.listDesignTemplates.mockResolvedValue({
    templates: [
      {
        ...template,
        metadata: {
          ...metadata,
          thumbnailUrl: "https://images.test/original.png",
        },
      },
    ],
    canManage: true,
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Edit details" }),
  );
  return coverUploadInput();
}

function coverUploadInput() {
  const dialog = screen.getByAltText("Template cover").closest('[role="dialog"]');
  const input = dialog?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("Missing cover upload input");
  }
  return input;
}

it("uploads a fixed cover, blocks saving while uploading and saves the returned URL", async () => {
  const input = await openDetailsWithCover();
  let finishUpload: (value: { dataUri: string }) => void = () => {};
  api.uploadImageFile.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
  );
  const file = new File(["image bytes"], "cover.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(api.uploadImageFile).toHaveBeenCalledWith({ imageFile: file }),
  );
  expect(
    screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByAltText("Template cover").getAttribute("src")).toBe(
    "https://images.test/original.png",
  );
  fireEvent.submit(
    screen
      .getByRole("textbox", { name: "Name" })
      .closest("form") as HTMLFormElement,
  );
  expect(api.updateDesignTemplate).not.toHaveBeenCalled();
  finishUpload({ dataUri: "https://images.test/uploaded.png" });
  await waitFor(() =>
    expect(screen.getByAltText("Template cover").getAttribute("src")).toBe(
      "https://images.test/uploaded.png",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.updateDesignTemplate).toHaveBeenCalledWith("template", {
      ...metadata,
      thumbnailUrl: "https://images.test/uploaded.png",
    }),
  );
  expect(api.publishDesignTemplate).not.toHaveBeenCalled();
});

it("keeps the saved cover after upload failure, allows retry, and removes it explicitly", async () => {
  const input = await openDetailsWithCover();
  api.uploadImageFile
    .mockRejectedValueOnce(new Error("Upload failed"))
    .mockResolvedValueOnce({ dataUri: "https://images.test/retry.webp" });
  fireEvent.change(input, {
    target: {
      files: [new File(["image"], "cover.webp", { type: "image/webp" })],
    },
  });
  await screen.findByText("Cover upload failed. Please try again.");
  expect(screen.getByAltText("Template cover").getAttribute("src")).toBe(
    "https://images.test/original.png",
  );
  expect(
    screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
  ).toBe(false);
  const retryInput = coverUploadInput();
  fireEvent.change(retryInput, {
    target: {
      files: [new File(["image"], "retry.webp", { type: "image/webp" })],
    },
  });
  await waitFor(() =>
    expect(screen.getByAltText("Template cover").getAttribute("src")).toBe(
      "https://images.test/retry.webp",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
  expect(screen.queryByAltText("Template cover")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.updateDesignTemplate).toHaveBeenCalledWith("template", metadata),
  );
});

it.each([
  new File(["text"], "cover.txt", { type: "text/plain" }),
  new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
    type: "image/png",
  }),
])(
  "rejects invalid cover files without changing the existing cover",
  async (file) => {
    const input = await openDetailsWithCover();
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Save" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(api.uploadImageFile).not.toHaveBeenCalled();
    expect(screen.getByAltText("Template cover").getAttribute("src")).toBe(
      "https://images.test/original.png",
    );
  },
);
