import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { Link as RouterLink, LinkProps } from "@/wab/client/route/Link";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

afterEach(cleanup);

function setup(props: Partial<LinkProps> = {}, initial = "/projects") {
  const history = createMemoryHistory({ initialEntries: [initial] });
  const push = vi.spyOn(history, "push");
  const replace = vi.spyOn(history, "replace");
  const listener = vi.fn();
  history.listen(listener);
  render(
    <HistoryProvider history={history}>
      <RouterLink to="/projects" {...props}>Projects</RouterLink>
    </HistoryProvider>,
  );
  return { history, push, replace, listener, link: screen.getByRole("link") };
}

it.each([undefined, false, true])(
  "does not publish navigation to the current location with replace=%s",
  (replace) => {
    const f = setup({ replace });
    const location = f.history.location;
    expect(fireEvent.click(f.link)).toBe(false);
    expect(f.history.location).toBe(location);
    expect(f.push).not.toHaveBeenCalled();
    expect(f.replace).not.toHaveBeenCalled();
    expect(f.listener).not.toHaveBeenCalled();
  },
);

it.each(["/projects/other", "/projects?q=one", "/projects#details"])(
  "navigates when pathname, query or hash changes: %s",
  (to) => {
    const f = setup({ to });
    fireEvent.click(f.link);
    expect(f.push).toHaveBeenCalledWith(to);
    expect(f.listener).toHaveBeenCalledTimes(1);
  },
);

it("replaces a different location when requested", () => {
  const f = setup({ to: "/playground", replace: true });
  fireEvent.click(f.link);
  expect(f.replace).toHaveBeenCalledWith("/playground");
  expect(f.history.index).toBe(0);
});

it("compares query-only links against the current pathname", () => {
  const f = setup({ to: "?q=one#details" }, "/projects?q=one#details");
  fireEvent.click(f.link);
  expect(f.listener).not.toHaveBeenCalled();
});

it.each([
  { ctrlKey: true },
  { metaKey: true },
  { shiftKey: true },
  { altKey: true },
  { button: 1 },
])("preserves browser handling for modified clicks: %o", (event) => {
  const f = setup({ to: "/playground" });
  const browserClick = vi.fn((e: MouseEvent) => {
    expect(e.defaultPrevented).toBe(false);
    // jsdom cannot follow links; inspect browser handling before cancelling it.
    e.preventDefault();
  });
  document.addEventListener("click", browserClick, { once: true });
  fireEvent.click(f.link, event);
  expect(browserClick).toHaveBeenCalledTimes(1);
  expect(f.listener).not.toHaveBeenCalled();
});

it("still calls the click handler on a repeated destination", () => {
  const onClick = vi.fn();
  const f = setup({ onClick });
  fireEvent.click(f.link);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(f.listener).not.toHaveBeenCalled();
});
