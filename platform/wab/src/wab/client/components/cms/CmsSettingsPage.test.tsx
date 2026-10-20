import CmsSettingsPage from "@/wab/client/components/cms/CmsSettingsPage";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { message, notification } from "antd";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  database: {
    id: "db1",
    publicToken: "public-test-token",
    secretToken: "secret-test-token",
    tables: [{ id: "model1" }],
    extraData: { locales: ["zh-CN"] },
  },
  updateDatabase: vi.fn(),
  mutate: vi.fn(),
  clone: vi.fn(),
  copy: vi.fn(() => true),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({
    updateCmsDatabase: mocks.updateDatabase,
    cloneCmsDatabase: mocks.clone,
  }),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsDatabase: () => ({ database: mocks.database }),
  useMutateDatabase: () => mocks.mutate,
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({ pathParams: { databaseId: "db1" } }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("copy-to-clipboard", () => ({ default: mocks.copy }));
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  mocks.updateDatabase.mockResolvedValue({});
  mocks.mutate.mockResolvedValue(undefined);
  vi.spyOn(notification, "success").mockImplementation(() => {});
  vi.spyOn(message, "success").mockReturnValue(mock());
  vi.spyOn(message, "error").mockReturnValue(mock());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("places both operations beside the page title above three settings sections within a single shared scroll viewport", async () => {
  const view = render(<CmsSettingsPage />);
  expect(screen.getAllByRole("region")).toHaveLength(3);
  const header = ensure(
    screen.getByRole("heading", { name: "Settings" }).closest("header"),
    "Missing settings header",
  );
  expect(within(header).getByRole("button", { name: "Save" })).toBeTruthy();
  expect(
    within(header).getByRole("button", { name: "Duplicate CMS Schema" }),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Locales" })).queryByRole(
      "button",
      { name: "Save" },
    ),
  ).toBeNull();
  await waitFor(() =>
    expect(
      view.container.querySelectorAll("[data-overlayscrollbars]"),
    ).toHaveLength(1),
  );
  expect(
    screen
      .getByRole("button", { name: "Save" })
      .closest("[data-overlayscrollbars]"),
  ).toBeTruthy();
});
it("masks private credentials and supports reveal, hide and copying the actual token", () => {
  const view = render(<CmsSettingsPage />);
  expect(
    view.container.querySelector('[data-test-id="secretToken"]'),
  ).toHaveTextContent("••••••••••••••••");
  expect(screen.queryByText("secret-test-token")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("secret-test-token")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  const row = ensure(
    view.container.querySelector('[data-test-id="secretToken"]')?.parentElement,
    "Missing secret token row",
  );
  fireEvent.click(within(row).getByRole("button", { name: "Copy" }));
  expect(mocks.copy).toHaveBeenCalledWith("secret-test-token");
  expect(within(row).getByRole("button", { name: "Copied" })).toBeTruthy();
});
it("saves only locale settings and refreshes the database", async () => {
  render(<CmsSettingsPage />);
  fireEvent.change(screen.getByRole("textbox", { name: "Locale code" }), {
    target: { value: "ja" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(mocks.updateDatabase).toHaveBeenCalledWith("db1", {
      extraData: { locales: ["ja"] },
    }),
  );
  expect(mocks.mutate).toHaveBeenCalledWith("db1");
  expect(message.success).toHaveBeenCalledWith({
    content: "Successfully saved changes",
  });
});
it("rejects duplicate locale codes before making an API request", async () => {
  render(<CmsSettingsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Add locale" }));
  fireEvent.change(screen.getAllByRole("textbox", { name: "Locale code" })[1], {
    target: { value: "zh-CN" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(message.error).toHaveBeenCalledWith({
      content: "Locales must all be distinct",
    }),
  );
  expect(mocks.updateDatabase).not.toHaveBeenCalled();
});
it("uses the existing schema-copy endpoint from the page header", async () => {
  mocks.clone.mockResolvedValue({ id: "db2" });
  render(<CmsSettingsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Duplicate CMS Schema" }));
  await waitFor(() => expect(mocks.clone).toHaveBeenCalledWith("db1"));
  expect(notification.success).toHaveBeenCalledWith(
    expect.objectContaining({ message: "CMS schema duplicated successfully." }),
  );
});
