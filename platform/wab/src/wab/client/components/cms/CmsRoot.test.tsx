import CmsRoot from "@/wab/client/components/cms/CmsRoot";
import { CmsDatabaseId } from "@/wab/shared/ApiSchema";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { SWRConfig } from "swr";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock("@/wab/client/contexts/AppContexts", async () => ({
  AppCtxContext: (await import("react")).createContext(undefined),
  useApi: () => ({ getCmsDatabase: mocks.getDatabase }),
}));
vi.mock("@/wab/client/components/PublicLink", () => ({
  PublicLink: (props) => <a {...props} />,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useLocation: () => ({ pathname: "/cms/db1/content" }),
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsRoot", () => ({
  PlasmicCmsRoot: (props) =>
    props.cmsContentPage?.render ? (
      props.cmsContentPage.render()
    ) : (
      <div>Content library ready</div>
    ),
}));
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

it("updates the window title when entering a different content library", async () => {
  mocks.getDatabase.mockImplementation(async (id) => ({
    id,
    name: id === "db1" ? "Audit CMS" : "Second CMS",
    tables: [],
  }));
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
  const view = render(<CmsRoot databaseId={"db1" as CmsDatabaseId} />, {
    wrapper,
  });
  await waitFor(() => expect(document.title).toBe("Audit CMS - Plasmic"));
  view.rerender(<CmsRoot databaseId={"db2" as CmsDatabaseId} />);
  await waitFor(() => expect(document.title).toBe("Second CMS - Plasmic"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.clearAllMocks();
});

it("recovers the content library from a failed request through the same SWR resource", async () => {
  mocks.getDatabase
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ id: "db1", tables: [] });
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <CmsRoot databaseId={"db1" as CmsDatabaseId} />
    </SWRConfig>,
  );
  expect(screen.getByRole("status")).toBeTruthy();
  await screen.findByText("Failed to load content library");
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Content library ready");
  expect(mocks.getDatabase).toHaveBeenCalledTimes(2);
  expect(mocks.getDatabase).toHaveBeenLastCalledWith("db1", true);
});
