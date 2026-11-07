import {
  isAnyModalOpen,
  subscribeModalOpen,
  useIsAnyModalOpen,
  useTrackOpenModal,
} from "@/wab/client/components/widgets/open-modals";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

function Tracked({ open }: { open: boolean }) {
  useTrackOpenModal(open);
  return null;
}

it("notifies and commits only the first open and last close across nested modals", () => {
  const commits = vi.fn();
  const notification = vi.fn();
  const off = subscribeModalOpen(notification);
  function Consumer() {
    const open = useIsAnyModalOpen();
    return <output>{String(open)}</output>;
  }
  const view = render(
    <>
      <Tracked open={false} />
      <Tracked open={false} />
      <React.Profiler id="open-modals" onRender={commits}>
        <Consumer />
      </React.Profiler>
    </>,
  );
  expect(notification.mock.calls).toEqual([[false]]);
  commits.mockClear();
  // Keep the consumer mounted without parent updates while modal owners change.
  const first = render(<Tracked open />);
  expect(screen.getByRole("status").textContent).toBe("true");
  expect(commits).toHaveBeenCalledOnce();
  commits.mockClear();
  const second = render(<Tracked open />);
  expect(commits).not.toHaveBeenCalled();
  first.unmount();
  expect(isAnyModalOpen()).toBe(true);
  expect(commits).not.toHaveBeenCalled();
  second.unmount();
  expect(screen.getByRole("status").textContent).toBe("false");
  expect(commits).toHaveBeenCalledOnce();
  expect(notification.mock.calls).toEqual([[false], [true], [false]]);
  off();
  view.unmount();
});

it("balances StrictMode effect replay, toggles and unmount cleanup", () => {
  const view = render(
    <React.StrictMode>
      <Tracked open />
    </React.StrictMode>,
  );
  expect(isAnyModalOpen()).toBe(true);
  view.rerender(
    <React.StrictMode>
      <Tracked open={false} />
    </React.StrictMode>,
  );
  expect(isAnyModalOpen()).toBe(false);
  view.rerender(
    <React.StrictMode>
      <Tracked open />
    </React.StrictMode>,
  );
  expect(isAnyModalOpen()).toBe(true);
  view.unmount();
  expect(isAnyModalOpen()).toBe(false);
  const notify = vi.fn();
  const off = subscribeModalOpen(notify);
  off();
  const next = render(<Tracked open />);
  next.unmount();
  expect(notify.mock.calls).toEqual([[false]]);
});
