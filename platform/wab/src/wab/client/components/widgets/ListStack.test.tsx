import {
  ListSpace,
  ListStack,
} from "@/wab/client/components/widgets/ListStack";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

const resize = vi.hoisted(() => ({
  instances: [] as {
    callback: (entries: { target: Element }[]) => void;
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("resize-observer-polyfill", () => ({
  default: class {
    observe = vi.fn();
    unobserve = vi.fn();
    constructor(readonly callback: (entries: { target: Element }[]) => void) {
      resize.instances.push(this);
    }
  },
}));
vi.mock("@/wab/client/dom-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/dom-utils")>()),
  useDisplayed: () => true,
}));

beforeEach(() => {
  vi.useFakeTimers();
  resize.instances = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(
  height = 500,
  firstSpace = 100,
  secondSpace = 500,
  firstMinimum?: number,
) {
  const first = vi.fn(({ height: allocated }: { height: number }) => (
    <output data-testid="first">{allocated}</output>
  ));
  const second = vi.fn(({ height: allocated }: { height: number }) => (
    <output data-testid="second">{allocated}</output>
  ));
  const view = render(
    <ListStack style={{ margin: 0, padding: 0, borderWidth: 0 }}>
      <ListSpace space={firstSpace} minSpace={firstMinimum}>
        {first}
      </ListSpace>
      <ListSpace space={secondSpace}>{second}</ListSpace>
    </ListStack>,
  );
  const root = view.container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing stack root");
  }
  Object.defineProperties(root, {
    offsetHeight: { configurable: true, get: () => height },
    offsetParent: { configurable: true, value: document.body },
  });
  act(() => {
    vi.advanceTimersByTime(1);
  });
  const observer = resize.instances.find((instance) =>
    instance.observe.mock.calls.some(([element]) => element === root),
  );
  if (!observer) {
    throw new Error("Missing stack resize observer");
  }
  return {
    ...view,
    first,
    second,
    root,
    observer,
    resize: (next: number) => {
      height = next;
      act(() => {
        observer.callback([{ target: root }]);
        vi.advanceTimersByTime(1);
      });
    },
  };
}

it("subscribes each list to its own allocation and skips unchanged resize passes", () => {
  const f = setup();
  expect(screen.getByTestId("first").textContent).toBe("100");
  expect(screen.getByTestId("second").textContent).toBe("400");
  f.first.mockClear();
  f.second.mockClear();
  f.resize(400);
  expect(screen.getByTestId("first").textContent).toBe("100");
  expect(screen.getByTestId("second").textContent).toBe("300");
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).toHaveBeenCalledOnce();
  f.second.mockClear();
  for (let i = 0; i < 100; i++) {
    f.resize(400);
  }
  expect(f.first).not.toHaveBeenCalled();
  expect(f.second).not.toHaveBeenCalled();
  f.unmount();
  expect(f.observer.unobserve).toHaveBeenCalledWith(f.root);
});

it("preserves minimum allocations and batches container cleanup", () => {
  const f = setup(150, 100, 100, 50);
  expect(screen.getByTestId("first").textContent).toBe("100");
  expect(screen.getByTestId("second").textContent).toBe("50");
  f.rerender(
    <ListStack style={{ margin: 0, padding: 0, borderWidth: 0 }}>
      <ListSpace space={100}>{f.first}</ListSpace>
    </ListStack>,
  );
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.getByTestId("first").textContent).toBe("100");
  expect(screen.queryByTestId("second")).toBeNull();
  f.unmount();
  act(() => {
    vi.runAllTimers();
  });
  expect(vi.getTimerCount()).toBe(0);
  expect(f.observer.unobserve).toHaveBeenCalledTimes(3);
});

it("does not share allocations between separate list stacks", () => {
  const f = setup(150, 100, 100);
  const second = render(
    <ListStack style={{ margin: 0, padding: 0, borderWidth: 0 }}>
      <ListSpace space={10}>
        {({ height }) => <output data-testid="independent">{height}</output>}
      </ListSpace>
    </ListStack>,
  );
  const root = second.container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing second stack");
  }
  Object.defineProperty(root, "offsetHeight", { value: 200 });
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.getByTestId("independent").textContent).toBe("10");
  f.resize(200);
  expect(screen.getByTestId("independent").textContent).toBe("10");
  expect(screen.getByTestId("first").textContent).toBe("100");
  expect(screen.getByTestId("second").textContent).toBe("100");
});
