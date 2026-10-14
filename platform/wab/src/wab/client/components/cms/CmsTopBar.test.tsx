import CmsTopBar, {
  CmsTopBarChrome,
} from "@/wab/client/components/cms/CmsTopBar";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  pathname: "/cms/db1/content",
  database: undefined as { id: string; name: string } | undefined,
  updateDatabase: vi.fn(),
  mutateDatabase: vi.fn(),
  appCtx: { appConfig: { brands: {} as Record<string, UiConfig["brand"]> } },
}));

vi.mock("@/wab/client/contexts/AppContexts", async () => ({
  AppCtxContext: (await import("react")).createContext(mocks.appCtx),
  useApi: () => ({ updateCmsDatabase: mocks.updateDatabase }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
}));
vi.mock("@/wab/client/components/cms/CmsLeftTabs", () => ({
  default: ({ activeTab }) => (
    <nav aria-label="CMS navigation">
      <a aria-current={activeTab === "content" ? "page" : undefined}>Content</a>
      <a aria-current={activeTab === "schema" ? "page" : undefined}>Models</a>
      <a aria-current={activeTab === "settings" ? "page" : undefined}>
        Settings
      </a>
    </nav>
  ),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsDatabase: () => ({ database: mocks.database }),
  useMutateDatabase: () => mocks.mutateDatabase,
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({ pathParams: { databaseId: "db1" } }),
}));
vi.mock("@/wab/client/components/PublicLink", () => ({
  PublicLink: (props) => <a {...props} />,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));

beforeEach(() => {
  mocks.pathname = "/cms/db1/content";
  mocks.database = { id: "db1", name: "Audit CMS" };
  mocks.appCtx.appConfig.brands = {};
  mocks.updateDatabase.mockResolvedValue({});
  mocks.mutateDatabase.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("uses the dashboard brand and dashboard navigation in both ready and loading headers", () => {
  const view = render(<CmsTopBar />);
  expect(view.container.querySelector("[data-desktop-update-slot]")).toBeNull();
  expect(screen.getByRole("banner")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Back to dashboard" })
      .getAttribute("href"),
  ).toBe("/");
  expect(screen.getByText("Plasmic")).toBeTruthy();
  expect(screen.getByText("Audit CMS")).toBeTruthy();
  view.rerender(
    <CmsTopBarChrome>
      <span>Loading CMS</span>
    </CmsTopBarChrome>,
  );
  expect(screen.getByRole("link", { name: "Back to dashboard" })).toBeTruthy();
  expect(screen.getByText("Plasmic")).toBeTruthy();
  expect(screen.getByText("Loading CMS")).toBeTruthy();
});

it("places desktop updates outside the brand capsule before the CMS title, including loading", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  const view = render(<CmsTopBar />);
  const assertSlot = () => {
    const slot = view.container.querySelector(
      '[data-desktop-update-slot="header"]',
    );
    const brand = screen.getByRole("link", { name: "Back to dashboard" });
    expect(slot?.previousElementSibling).toBe(brand.parentElement);
    expect(brand.parentElement?.contains(slot)).toBe(false);
    expect(screen.getByRole("banner").contains(slot)).toBe(true);
    return slot;
  };
  expect(assertSlot()?.parentElement?.parentElement?.textContent).toContain(
    "Audit CMS",
  );
  view.rerender(
    <CmsTopBarChrome>
      <span>Loading CMS</span>
    </CmsTopBarChrome>,
  );
  expect(assertSlot()?.parentElement?.parentElement?.textContent).toContain(
    "Loading CMS",
  );
});

it("honors the application's configured logo and destination", () => {
  mocks.appCtx.appConfig.brands[""] = {
    logoImgSrc: "/brand.svg",
    logoAlt: "Configured product",
    logoHref: "/projects",
  };
  render(<CmsTopBar />);
  expect(
    screen.getByRole("img", { name: "Configured product" }).getAttribute("src"),
  ).toBe("/brand.svg");
  expect(
    screen
      .getByRole("link", { name: "Back to dashboard" })
      .getAttribute("href"),
  ).toBe("/projects");
  expect(screen.queryByText("Plasmic")).toBeNull();
});

it("keeps CMS name editing connected to its database and cache", async () => {
  render(<CmsTopBar />);
  fireEvent.click(screen.getByText("Audit CMS"));
  const input = await screen.findByRole("textbox");
  fireEvent.change(input, { target: { value: "Renamed CMS" } });
  fireEvent.keyPress(input, { key: "Enter", charCode: 13 });
  await waitFor(() =>
    expect(mocks.updateDatabase).toHaveBeenCalledWith("db1", {
      name: "Renamed CMS",
    }),
  );
  expect(mocks.mutateDatabase).toHaveBeenCalledWith("db1");
});

it.each([
  ["content", "Content"],
  ["schemas/model", "Models"],
  ["settings", "Settings"],
])(
  "places %s navigation in the header beside the compact database context",
  (path, selected) => {
    mocks.pathname = `/cms/db1/${path}`;
    render(<CmsTopBar />);
    const banner = screen.getByRole("banner");
    const navigation = screen.getByRole("navigation");
    expect(banner.contains(navigation)).toBe(true);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe(
      selected,
    );
    expect(navigation.previousElementSibling?.textContent).toContain(
      "Audit CMS",
    );
  },
);
