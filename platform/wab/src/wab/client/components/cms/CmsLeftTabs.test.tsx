import CmsLeftTabs from "@/wab/client/components/cms/CmsLeftTabs";
import { CmsDatabaseId, CmsTableId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({ accessLevel: "editor" }));
vi.mock("@/wab/client/components/PublicLink", () => ({
  PublicLink: (props) => <a {...props} />,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsDatabase: () => ({ database: { workspaceId: "workspace" } }),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    workspaces: [{ id: "workspace", team: { id: "team" } }],
    selfInfo: { id: "user" },
    perms: [
      {
        workspaceId: "workspace",
        userId: "user",
        accessLevel: mocks.accessLevel,
      },
    ],
  }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: { databaseId: "database" as CmsDatabaseId, tableId: "model" },
  }),
}));
afterEach(() => {
  cleanup();
  mocks.accessLevel = "editor";
});

it("keeps the selected model when switching sections and identifies the active page", () => {
  render(<CmsLeftTabs activeTab="schema" />);
  expect(
    screen.getByRole("link", { name: "Content" }).getAttribute("href"),
  ).toBe(
    APP_ROUTES.cmsModelContent.fill({
      databaseId: "database" as CmsDatabaseId,
      tableId: "model" as CmsTableId,
    }),
  );
  const models = screen.getByRole("link", { name: "Models" });
  expect(models.getAttribute("href")).toBe(
    APP_ROUTES.cmsModelSchema.fill({
      databaseId: "database" as CmsDatabaseId,
      tableId: "model" as CmsTableId,
    }),
  );
  expect(models.getAttribute("aria-current")).toBe("page");
  expect(
    screen.getByRole("link", { name: "Content" }).hasAttribute("aria-current"),
  ).toBe(false);
  expect(
    screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
  ).toBe(
    APP_ROUTES.cmsSettings.fill({ databaseId: "database" as CmsDatabaseId }),
  );
});

it("hides settings for readers", () => {
  mocks.accessLevel = "viewer";
  render(<CmsLeftTabs activeTab="content" />);
  expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
});
