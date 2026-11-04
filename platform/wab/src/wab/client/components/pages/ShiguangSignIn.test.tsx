import { ShiguangSignIn } from "@/wab/client/components/pages/ShiguangSignIn";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import { cleanup, render } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

vi.mock("@/wab/shared/shiguang-auth", () => ({
  // Keep navigation within jsdom while checking the destination passed to auth.
  getShiguangSignInUrl: vi.fn(() => "#sign-in"),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

const presentation = "/d/0123456789?width=1440#/coupons/42?tag=a&tag=b#rules";
const login = `/login?${new URLSearchParams({ continueTo: presentation })}`;

it.each([presentation, login])("uses the current application route at %s", (route) => {
  render(
    <HistoryProvider history={createMemoryHistory({ initialEntries: [route] })}>
      <ShiguangSignIn />
    </HistoryProvider>,
  );
  expect(getShiguangSignInUrl).toHaveBeenCalledWith(window.location.origin + route);
});

it("passes the startup failure's login route to auth without discarding its continuation", () => {
  render(
    <HistoryProvider history={createMemoryHistory()}>
      <ShiguangSignIn returnTo={login} />
    </HistoryProvider>,
  );
  expect(getShiguangSignInUrl).toHaveBeenCalledWith(window.location.origin + login);
});

it("rejects an explicit destination outside Studio", () => {
  render(
    <HistoryProvider history={createMemoryHistory()}>
      <ShiguangSignIn returnTo="https://other.example/" />
    </HistoryProvider>,
  );
  expect(getShiguangSignInUrl).toHaveBeenCalledWith(window.location.origin + "/");
});
