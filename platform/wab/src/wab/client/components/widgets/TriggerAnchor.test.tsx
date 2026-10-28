import {
  chainTriggerProps,
  TriggerChildProps,
  TriggerTarget,
  watchUnanchoredPopups,
} from "@/wab/client/components/widgets/TriggerAnchor";
import { act, fireEvent, render } from "@testing-library/react";
import { Popover, Tooltip } from "antd";
import React from "react";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

// Like generated Plasmic components: spreads props onto its root, drops refs.
function Plain(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-testid="plain" {...props} />;
}

const openPopup = () =>
  document.querySelector(
    ".ant-tooltip:not(.ant-tooltip-hidden), .ant-popover:not(.ant-popover-hidden)",
  );

it("anchors a trigger on a child that drops refs and keeps its handlers", async () => {
  vi.useFakeTimers();
  const ownEnter = vi.fn();
  const { getByTestId } = render(
    <Tooltip title="Hint" mouseEnterDelay={0}>
      <TriggerTarget>
        <Plain onMouseEnter={ownEnter} />
      </TriggerTarget>
    </Tooltip>,
  );
  const plain = getByTestId("plain");
  const rect = vi
    .spyOn(plain, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(200, 300, 40, 20));
  fireEvent.mouseEnter(plain);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  expect(ownEnter).toHaveBeenCalled();
  expect(openPopup()?.textContent).toContain("Hint");
  // The popup was aligned against the child's real DOM node.
  expect(rect).toHaveBeenCalled();
});

it("keeps a click-triggered popover open when pressing its trigger", async () => {
  vi.useFakeTimers();
  const { getByTestId } = render(
    <Popover trigger="click" content="Body">
      <TriggerTarget>
        <Plain />
      </TriggerTarget>
    </Popover>,
  );
  const plain = getByTestId("plain");
  fireEvent.click(plain);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  expect(openPopup()?.textContent).toContain("Body");
  fireEvent.mouseDown(plain);
  fireEvent.pointerDown(plain);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  expect(openPopup()).toBeTruthy();
});

it("passes the ref straight to host children without adding markers", () => {
  const ref = React.createRef<HTMLButtonElement>();
  const anchor = vi.fn();
  const { container } = render(
    <TriggerTarget ref={anchor}>
      <button ref={ref}>Go</button>
    </TriggerTarget>,
  );
  expect(container.querySelector("template")).toBeNull();
  expect(ref.current?.tagName).toBe("BUTTON");
  expect(anchor).toHaveBeenLastCalledWith(ref.current);
});

it("wraps text children in a span anchor", () => {
  const anchor = vi.fn();
  const { container } = render(
    <TriggerTarget ref={anchor}>{"Plain text"}</TriggerTarget>,
  );
  const span = container.querySelector("span");
  expect(span?.textContent).toBe("Plain text");
  expect(anchor).toHaveBeenLastCalledWith(span);
});

it("chains handlers and joins classes set by both sides", () => {
  const own = vi.fn();
  const trigger = vi.fn();
  const merged = chainTriggerProps(
    { onClick: trigger, className: "ant-dropdown-open" },
    { onClick: own, className: "button" },
  );
  merged.onClick?.({} as React.MouseEvent<HTMLElement>);
  expect(own).toHaveBeenCalled();
  expect(trigger).toHaveBeenCalled();
  expect(merged.className).toBe("button ant-dropdown-open");
});

it("keeps the trigger's handlers and class when the child passes undefined", () => {
  const trigger = vi.fn();
  const merged = chainTriggerProps(
    { onClick: trigger, className: "ant-dropdown-open" },
    { onClick: undefined, className: undefined } as TriggerChildProps,
  );
  merged.onClick?.({} as React.MouseEvent<HTMLElement>);
  expect(trigger).toHaveBeenCalled();
  expect(merged.className).toBe("ant-dropdown-open");
});

it("re-anchors when the child changes to a component that drops refs", () => {
  const anchor = vi.fn();
  const { rerender, getByTestId } = render(
    <TriggerTarget ref={anchor}>
      <button>Go</button>
    </TriggerTarget>,
  );
  expect(anchor).toHaveBeenLastCalledWith(expect.any(HTMLButtonElement));
  rerender(
    <TriggerTarget ref={anchor}>
      <Plain />
    </TriggerTarget>,
  );
  expect(anchor).toHaveBeenLastCalledWith(getByTestId("plain"));
});

it("warns about popups that never got an anchor", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const stop = watchUnanchoredPopups(document);
  const aligned = document.createElement("div");
  aligned.className = "ant-popover";
  aligned.style.left = "120px";
  const popup = document.createElement("div");
  popup.className = "ant-tooltip";
  popup.style.left = "-1000vw";
  document.body.append(aligned, popup);
  // Real timers: the observer reports after its 500ms grace period.
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][1]).toBe(popup);
  stop();
  warn.mockRestore();
});
