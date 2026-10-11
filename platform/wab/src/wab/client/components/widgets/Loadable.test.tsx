import { Loadable } from "@/wab/client/components/widgets";
import { ensure } from "@/wab/shared/common";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as React from "react";

const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/ErrorNotifications", () => ({ reportError }));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("replaces pending content with a retry action and recovers", async () => {
  const error = new Error("502 Bad Gateway");
  const loader = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(error)
    .mockResolvedValue("Loaded");
  render(
    <Loadable
      loader={loader}
      loadingContents={() => <div role="status">Loading</div>}
      contents={(data) => <div>{data}</div>}
    />,
  );
  expect(screen.getByRole("status")).toBeTruthy();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(reportError).toHaveBeenCalledWith(error);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(screen.getByRole("status")).toBeTruthy();
  expect(await screen.findByText("Loaded")).toBeTruthy();
  expect(loader).toHaveBeenCalledTimes(2);
});

it("handles a loader that throws before returning a promise", async () => {
  render(
    <Loadable
      loader={() => {
        throw new Error("Failed");
      }}
      contents={() => null}
    />,
  );
  expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
});

it("handles canceled requests without surfacing an error after unmount", async () => {
  let reject: ((reason: Error) => void) | undefined;
  const promise = new Promise<string>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  const loader = vi.fn(() => promise);
  const { unmount } = render(
    <Loadable loader={loader} contents={() => null} />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(loader).toHaveBeenCalledOnce();
  unmount();
  await act(async () =>
    ensure(
      reject,
      "Pending loader must provide its reject callback",
    )(new Error("502")),
  );
  expect(reportError).not.toHaveBeenCalled();
});
