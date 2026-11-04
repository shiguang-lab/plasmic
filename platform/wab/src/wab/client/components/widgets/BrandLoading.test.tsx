import { BrandLogo } from "@/wab/client/components/BrandLogo";
import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { ensure } from "@/wab/shared/common";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as React from "react";
import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";

let animations: {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
}[];
let media: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
const asset = new Blob(["construction"]);
beforeEach(() => {
  animations = [];
  media = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(
    media as unknown as MediaQueryList,
  );
  vi.spyOn(Element.prototype, "animate").mockImplementation(function (
    this: Element,
    keyframes,
    options,
  ) {
    const animation = {
      element: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      cancel: vi.fn(),
    };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, blob: async () => asset }),
  );
  let url = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:construction-${++url}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(window, "requestAnimationFrame");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function loaded(container: HTMLElement) {
  await act(async () => {
    await Promise.resolve();
  });
  const image = ensure(
    container.querySelector<HTMLImageElement>("[data-construction]"),
    "Construction image",
  );
  fireEvent.load(image);
  return image;
}

it("keeps simultaneous gradient logos independent", () => {
  const { container } = render(
    <>
      <BrandLogo />
      <BrandLogo />
    </>,
  );
  const gradients = container.querySelectorAll("linearGradient");
  expect(gradients).toHaveLength(2);
  expect(gradients[0].id).not.toBe(gradients[1].id);
  container
    .querySelectorAll("svg")
    .forEach((svg, i) =>
      expect(svg.querySelector("g")?.getAttribute("fill")).toBe(
        `url(#${gradients[i].id})`,
      ),
    );
});

it("keeps construction and long-wait shimmer without JS frame callbacks", async () => {
  const { container } = render(<BrandLoading />);
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  const image = await loaded(container);
  expect(image.src).toBe("blob:construction-1");
  expect(image.style.opacity).toBe("1");
  expect(container.querySelector("mask")).toBeNull();
  expect(container.querySelector("[data-lights]")).toBeNull();
  expect(
    container.querySelectorAll("[data-scaffold] [clip-path] path"),
  ).toHaveLength(44);
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  const fade = animations[0];
  expect(fade.element).toBe(container.querySelector("svg"));
  expect(fade.options).toEqual({ duration: 3192, fill: "forwards" });
  expect(fade.keyframes[0].opacity).toBe(1);
  expect(fade.keyframes[64].opacity).toBe(0);
  const shimmer = animations[1];
  expect(shimmer.element).toBe(container.querySelector("[data-sheen]"));
  expect(shimmer.element.closest("svg")).toBeNull();
  expect(shimmer.element.parentElement?.style.maskImage).toContain(
    "data:image/svg+xml",
  );
  expect(shimmer.options).toEqual({
    duration: 2400,
    iterations: Infinity,
    easing: "linear",
    delay: 3192,
    fill: "both",
  });
});

it("does not fetch or animate with reduced motion", async () => {
  media.matches = true;
  const { container } = render(<BrandLoading />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(animations).toHaveLength(0);
  expect(container.querySelector("[data-solid]")?.getAttribute("opacity")).toBe(
    "1",
  );
});

it("aborts loading, cancels owned animations and releases decoded image on unmount", async () => {
  const { container, unmount } = render(<BrandLoading />);
  const image = await loaded(container);
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  expect(image.hasAttribute("src")).toBe(false);
  expect(image.onload).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:construction-1");
  expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(media.removeEventListener).toHaveBeenCalledOnce();
});

it("ignores an asset response that arrives after unmount", async () => {
  let resolve: (value: Response) => void = () => {
    throw new Error("Response resolver not installed");
  };
  vi.mocked(fetch).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }) as Promise<Response>,
  );
  const { unmount } = render(<BrandLoading />);
  unmount();
  await act(async () => {
    resolve({ ok: true, blob: async () => asset } as Response);
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(animations).toHaveLength(0);
});

it("replays from its own image timeline after reduced-motion changes", async () => {
  const { container } = render(<BrandLoading />);
  const image = await loaded(container);
  const change = media.addEventListener.mock.calls[0][1];
  media.matches = true;
  await act(async () => change());
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:construction-1");
  expect(image.style.opacity).toBe("0");
  expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(container.querySelector("[data-solid]")?.getAttribute("opacity")).toBe(
    "1",
  );
  media.matches = false;
  await act(async () => change());
  fireEvent.load(image);
  expect(image.src).toBe("blob:construction-2");
  expect(animations).toHaveLength(4);
});

it("uses independent playback URLs for simultaneous loaders", async () => {
  const { container } = render(
    <>
      <BrandLoading />
      <BrandLoading />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  const images = container.querySelectorAll<HTMLImageElement>(
    "[data-construction]",
  );
  expect(images[0].src).not.toBe(images[1].src);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
});

it("shows the static gradient if the bundled asset fails to load", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("unavailable"));
  const { container } = render(<BrandLoading />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(container.querySelector("[data-solid]")?.getAttribute("opacity")).toBe(
    "1",
  );
  expect(
    container.querySelector("[data-scaffold]")?.getAttribute("opacity"),
  ).toBe("0");
  expect(animations).toHaveLength(0);
});

it("omits the covered subtree, restores local loading after reveal, and replays after hiding", async () => {
  const view = (enabled: boolean) => <LoadingAnimationContext.Provider value={enabled}><BrandLoading /></LoadingAnimationContext.Provider>;
  const { container, rerender } = render(view(false));
  await act(async () => { await Promise.resolve(); });
  expect(fetch).not.toHaveBeenCalled();
  expect(animations).toHaveLength(0);
  expect(container.childElementCount).toBe(0);
  rerender(view(true));
  await loaded(container);
  expect(fetch).toHaveBeenCalledOnce();
  expect(animations).toHaveLength(2);
  expect(container.querySelectorAll("[data-scaffold] [clip-path] path")).toHaveLength(44);
  const image = container.querySelector("[data-construction]");
  const url = image?.getAttribute("src");
  rerender(view(false));
  expect(animations.every(a => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(container.childElementCount).toBe(0);
  expect(image?.getAttribute("src")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  rerender(view(true));
  const replayed = await loaded(container);
  expect(replayed.getAttribute("src")).not.toBe(url);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(animations).toHaveLength(4);
});
