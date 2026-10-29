import { ProjectPreview } from "@/wab/client/components/dashboard/preview/ProjectPreview";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), cancel: vi.fn() }));
vi.mock("@/wab/client/components/dashboard/preview/client", () => ({
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
