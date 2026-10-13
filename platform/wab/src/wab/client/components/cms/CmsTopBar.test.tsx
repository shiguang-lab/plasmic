import CmsTopBar, {
  CmsTopBarChrome,
} from "@/wab/client/components/cms/CmsTopBar";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  database: undefined as { id: string; name: string } | undefined,
  updateDatabase: vi.fn(),
  mutateDatabase: vi.fn(),
  appCtx: { appConfig: { brands: {} as Record<string, UiConfig["brand"]> } },
}));

vi.mock("@/wab/client/contexts/AppContexts", async () => ({
  AppCtxContext: (await import("react")).createContext(mocks.appCtx),
  useApi: () => ({ updateCmsDatabase: mocks.updateDatabase }),
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
  expect(screen.getByRole("banner")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/");
  expect(screen.getByText("Plasmic")).toBeTruthy();
  expect(screen.getByText("Audit CMS")).toBeTruthy();
  view.rerender(<CmsTopBarChrome><span>Loading CMS</span></CmsTopBarChrome>);
  expect(screen.getByRole("link", { name: "Back to dashboard" })).toBeTruthy();
  expect(screen.getByText("Plasmic")).toBeTruthy();
  expect(screen.getByText("Loading CMS")).toBeTruthy();
});

it("honors the application's configured logo and destination", () => {
  mocks.appCtx.appConfig.brands[""] = {
    logoImgSrc: "/brand.svg",
    logoAlt: "Configured product",
    logoHref: "/projects",
  };
  render(<CmsTopBar />);
  expect(screen.getByRole("img", { name: "Configured product" }).getAttribute("src")).toBe("/brand.svg");
  expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/projects");
  expect(screen.queryByText("Plasmic")).toBeNull();
});

it("keeps CMS name editing connected to its database and cache", async () => {
  render(<CmsTopBar />);
  fireEvent.click(screen.getByText("Audit CMS"));
  const input = await screen.findByRole("textbox");
  fireEvent.change(input, { target: { value: "Renamed CMS" } });
  fireEvent.keyPress(input, { key: "Enter", charCode: 13 });
  await waitFor(() => expect(mocks.updateDatabase).toHaveBeenCalledWith("db1", { name: "Renamed CMS" }));
  expect(mocks.mutateDatabase).toHaveBeenCalledWith("db1");
});
