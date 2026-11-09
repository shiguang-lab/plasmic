import { ProjectPreview } from "@/wab/client/components/dashboard/preview/ProjectPreview";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), cancel: vi.fn() }));
vi.mock("@/wab/client/components/dashboard/preview/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/wab/client/components/dashboard/preview/client")>(),
  subscribePreview: mocks.subscribe,
}));
let visibility: IntersectionObserverCallback;
beforeEach(() => {
  mocks.subscribe.mockReturnValue(mocks.cancel);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        visibility = callback;
      }
      observe() {
        /* Driven by intersect() in this test. */
      }
      disconnect() {
        /* No native observer resources in this mock. */
      }
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
function intersect(visible: boolean) {
  act(() =>
    visibility(
      [{ isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
}

it("generates only visible previews and revokes the image when leaving or unmounting", () => {
  const { container, unmount } = render(
    <ProjectPreview userId="user" projectId="p" updatedAt="today" />,
  );
  expect(mocks.subscribe).not.toHaveBeenCalled();
  // Waiting in the queue: static skeleton, no per-frame animation.
  expect(container.querySelector(".ant-skeleton-node")).not.toBeNull();
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  expect(container.textContent).toBe("");
  intersect(true);
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  act(() => {
    mocks.subscribe.mock.calls[0][3]();
  });
  expect(container.querySelector(".ant-skeleton-active")).not.toBeNull();
  act(() => {
    mocks.subscribe.mock.calls[0][2](new Blob());
  });
  expect(container.querySelector("img")?.src).toBe("blob:preview");
  expect(container.querySelector(".ant-skeleton-active")).not.toBeNull();
  const image = container.querySelector("img");
  expect(image?.style.visibility).toBe("hidden");
  if (!image) {
    throw new Error("Expected preview image");
  }
  fireEvent.load(image);
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  expect(image.style.visibility).toBe("visible");
  intersect(false);
  expect(mocks.cancel).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector(".ant-skeleton-node")).not.toBeNull();
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  intersect(true);
  act(() => {
    mocks.subscribe.mock.calls[1][2](new Blob());
  });
  unmount();
  expect(mocks.cancel).toHaveBeenCalledTimes(2);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it("retains an image skeleton after generation fails and animates again when a retry generates", () => {
  const { container } = render(
    <ProjectPreview userId="user" projectId="p" updatedAt="today" />,
  );
  intersect(true);
  act(() => {
    mocks.subscribe.mock.calls[0][3]();
    mocks.subscribe.mock.calls[0][2](undefined);
  });
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  expect(container.querySelector(".ant-skeleton-node")).not.toBeNull();
  expect(container.textContent).toBe("");
  intersect(false);
  intersect(true);
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  act(() => {
    mocks.subscribe.mock.calls[1][3]();
  });
  expect(container.querySelector(".ant-skeleton-active")).not.toBeNull();
  expect(container.textContent).toBe("");
});

it("keeps a cached image visible while a newer preview generates", () => {
  const { container } = render(
    <ProjectPreview userId="user" projectId="p" updatedAt="today" />,
  );
  intersect(true);
  act(() => {
    mocks.subscribe.mock.calls[0][2](new Blob());
  });
  const image = container.querySelector("img");
  if (!image) {
    throw new Error("Expected preview image");
  }
  fireEvent.load(image);
  act(() => {
    mocks.subscribe.mock.calls[0][3]();
  });
  expect(container.querySelector(".ant-skeleton-node")).toBeNull();
  expect(image.style.visibility).toBe("visible");
});

it("retains an image skeleton if the generated image cannot be decoded", () => {
  const { container } = render(
    <ProjectPreview userId="user" projectId="p" updatedAt="today" />,
  );
  intersect(true);
  act(() => {
    mocks.subscribe.mock.calls[0][2](new Blob());
  });
  const image = container.querySelector("img");
  if (!image) {
    throw new Error("Expected preview image");
  }
  fireEvent.error(image);
  expect(container.querySelector(".ant-skeleton-active")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector(".ant-skeleton-node")).not.toBeNull();
  expect(container.textContent).toBe("");
});

it("cancels queued Desktop previews and restarts them on Dashboard activation", () => {
  let active=true;
  let change:()=>void=()=>undefined;
  const stop=vi.fn();
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation",{isActive:()=>active,onActiveChange:(callback:()=>void)=>{change=callback;return stop;}});
  const {unmount}=render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);expect(mocks.subscribe).toHaveBeenCalledOnce();
  act(()=>{active=false;change();});expect(mocks.cancel).toHaveBeenCalledOnce();
  intersect(true);expect(mocks.subscribe).toHaveBeenCalledOnce();
  act(()=>{active=true;change();});expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  unmount();expect(stop).toHaveBeenCalledOnce();
});

it("lets the running Desktop preview finish while hidden, releases its image, and resumes from cache", () => {
  let active = true;
  let change: () => void = () => undefined;
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation", { isActive: () => active, onActiveChange: (callback: () => void) => { change = callback; return () => undefined; } });
  const { container, unmount } = render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);
  const [, , deliver, start, finish] = mocks.subscribe.mock.calls[0];
  act(() => { deliver(new Blob()); start(); });
  expect(container.querySelector("img")).not.toBeNull();
  act(() => { active = false; change(); });
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  expect(container.querySelector("img")).toBeNull();
  intersect(false);
  expect(mocks.cancel).not.toHaveBeenCalled();
  act(() => { deliver(new Blob()); finish(); });
  expect(mocks.cancel).toHaveBeenCalledOnce();
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
  expect(container.querySelector("img")).toBeNull();
  intersect(true);
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  act(() => { active = true; change(); });
  expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  unmount();
});

it("releases a hidden finished refresh even when no replacement image is delivered", () => {
  let active = true;
  let change: () => void = () => undefined;
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation", { isActive: () => active, onActiveChange: (callback: () => void) => { change = callback; return () => undefined; } });
  render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);
  act(() => { mocks.subscribe.mock.calls[0][3](); active = false; change(); });
  expect(mocks.cancel).not.toHaveBeenCalled();
  act(() => { mocks.subscribe.mock.calls[0][4](); });
  expect(mocks.cancel).toHaveBeenCalledOnce();
});

it("cancels running work on account replacement or unmount and ignores retired callbacks", () => {
  let active = true;
  let change: () => void = () => undefined;
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation", { isActive: () => active, onActiveChange: (callback: () => void) => { change = callback; return () => undefined; } });
  const { rerender, unmount } = render(<ProjectPreview userId="old" projectId="p" updatedAt="today" />);
  intersect(true);
  const old = mocks.subscribe.mock.calls[0];
  act(() => { old[3](); active = false; change(); });
  rerender(<ProjectPreview userId="new" projectId="p" updatedAt="today" />);
  expect(mocks.cancel).toHaveBeenCalledOnce();
  act(() => { old[2](new Blob()); old[3](); old[4](); });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  act(() => { active = true; change(); });
  intersect(true);
  expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  act(() => { mocks.subscribe.mock.calls[1][3](); });
  unmount();
  expect(mocks.cancel).toHaveBeenCalledTimes(2);
  act(() => { mocks.subscribe.mock.calls[1][2](new Blob()); mocks.subscribe.mock.calls[1][4](); });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("still cancels a running browser preview when its document becomes hidden", () => {
  render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);
  act(() => { mocks.subscribe.mock.calls[0][3](); });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.cancel).toHaveBeenCalledOnce();
});

it.each(["visibility-first", "activation-first", "intersection-first"])("preserves the one running Desktop job with %s delivery", (order) => {
  let active = true;
  let change: () => void = () => undefined;
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation", { isActive: () => active, onActiveChange: (callback: () => void) => { change = callback; return () => undefined; } });
  const { container } = render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);
  act(() => { mocks.subscribe.mock.calls[0][3](); });
  const hideDocument = () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  };
  const deactivate = () => act(() => { active = false; change(); });
  if (order === "visibility-first") { hideDocument(); deactivate(); }
  else if (order === "activation-first") { deactivate(); hideDocument(); }
  else { intersect(false); hideDocument(); deactivate(); }
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  act(() => { mocks.subscribe.mock.calls[0][2](new Blob()); mocks.subscribe.mock.calls[0][4](); });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(container.querySelector("img")).toBeNull();
  expect(mocks.cancel).toHaveBeenCalledOnce();
});

it("cancels queued Desktop work on minimization and finishes only an already running job", () => {
  vi.stubGlobal("desktopPreview", { render: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("desktopNavigation", { isActive: () => true, onActiveChange: () => () => undefined });
  render(<ProjectPreview userId="user" projectId="p" updatedAt="today" />);
  intersect(true);
  const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.cancel).toHaveBeenCalledOnce();
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  state.mockReturnValue("visible");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  act(() => { mocks.subscribe.mock.calls[1][3](); });
  state.mockReturnValue("hidden");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.cancel).toHaveBeenCalledOnce();
  act(() => { mocks.subscribe.mock.calls[1][2](new Blob()); mocks.subscribe.mock.calls[1][4](); });
  expect(mocks.cancel).toHaveBeenCalledTimes(2);
  expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
