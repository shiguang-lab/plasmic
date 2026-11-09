import { DEVFLAGS } from "@/wab/shared/devflags";
import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { NormalLayout } from "@/wab/client/components/normal-layout";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { ApiUser } from "@/wab/shared/ApiSchema";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/studio/Avatar", () => ({ Avatar: ({ user }: { user: ApiUser }) => <button>{user.displayName}</button> }));
vi.mock("@/wab/client/components/widgets/BrowserAlertBanner", () => ({ BrowserAlertBanner: () => null }));
vi.mock("@/wab/client/components/PublicLink", () => ({ PublicLink: (props: React.ComponentProps<"a">) => <a {...props} /> }));

afterEach(cleanup);
it("updates account and brand publications and runs logout on the same account owner", async () => {
  const { appCtx } = fakeAppCtx({ devFlagOverrides: { brands: { ...DEVFLAGS.brands, "": { ...DEVFLAGS.brands[""], logoTooltip: "First brand", logoHref: "/first", logoImgSrc: undefined } } } });
  appCtx.selfInfo = mock<ApiUser>({ displayName: "First account" });
  const logout = vi.spyOn(appCtx, "logout").mockResolvedValue(undefined);
  render(<AppCtxContext.Provider value={appCtx}><NormalLayout appCtx={appCtx}>Account content</NormalLayout></AppCtxContext.Provider>);
  expect(screen.getByRole("link", { name: "First brand" }).getAttribute("href")).toBe("/first");
  expect(screen.getByText("Account content")).toBeTruthy();
  act(() => {
    appCtx.selfInfo = mock<ApiUser>({ displayName: "Updated account" });
    appCtx.appConfig = { ...appCtx.appConfig, brands: { ...appCtx.appConfig.brands, "": { ...appCtx.appConfig.brands[""], logoTooltip: "Updated brand", logoHref: "/updated", logoImgSrc: undefined } } };
    appCtx.publishUiEnvironmentInputs();
  });
  expect(screen.queryByRole("button", { name: "First account" })).toBeNull();
  expect(screen.getByRole("link", { name: "Updated brand" }).getAttribute("href")).toBe("/updated");
  fireEvent.click(screen.getByRole("button", { name: "Updated account" }));
  fireEvent.click(await screen.findByText("Sign Out"));
  expect(logout).toHaveBeenCalledOnce();
});
