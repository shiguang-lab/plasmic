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
  ...metadata,
  version: "1.0.0",
  publishedAt: "2026-11-17T00:00:00Z",
  previewUrl: "https://preview.test/s/reference",
  libraries: ["Material UI"],
};
const template = { id: "template", published };
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
it("resolves the latest publication when opening a reference", async () => {
  setup();
  await screen.findByText("移动端登录");
  api.listDesignTemplates.mockResolvedValue({
    templates: [
      {
        ...template,
        published: { ...published, name: "最新登录模板", version: "1.1.0" },
      },
    ],
    canManage: false,
  });
  fireEvent.click(
    screen.getByRole("button", { name: "View published template" }),
  );
  expect((await screen.findByTitle("最新登录模板")).getAttribute("src")).toBe(
    published.previewUrl,
  );
  expect(api.listDesignTemplates.mock.calls.length).toBeGreaterThanOrEqual(2);
});
it("creates a standalone template and opens its draft canvas", async () => {
  api.listDesignTemplates.mockResolvedValue({ templates: [], canManage: true });
  api.createDesignTemplate.mockResolvedValue({
    template: { id: "new-template", draft: metadata, published: null },
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
it("maintains draft details independently of the published reference", async () => {
  api.listDesignTemplates.mockResolvedValue({
    templates: [
      { ...template, draft: { ...metadata, name: "未发布的新标题" } },
    ],
    canManage: true,
  });
  api.updateDesignTemplate.mockResolvedValue({});
  setup();
  await screen.findByText("未发布的新标题");
  fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
  expect(
    (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
  ).toBe("未发布的新标题");
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "修改草稿" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() =>
    expect(api.updateDesignTemplate).toHaveBeenCalledWith("template", {
      ...metadata,
      name: "修改草稿",
    }),
  );
  expect(api.publishDesignTemplate).not.toHaveBeenCalled();
});
