import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { useScaledElementRef, useZoomStyledRef } from "@/wab/client/hooks/useScaledElementRef";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { Pt } from "@/wab/shared/geom";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ studio: undefined as unknown as StudioCtx }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => fixture.studio }));
afterEach(() => cleanup());

function setup(scale = 1) {
  const owner = createViewportFixture(scale);
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, Object.getOwnPropertyDescriptors(owner));
  fixture.studio = studio;
  return { studio, owner, viewport: ensure(owner.viewportCtx, "Viewport") };
}

it("applies initial styles, follows only scale and releases obsolete viewport ownership", () => {
  const { owner, viewport } = setup(2);
  const styles = vi.fn((zoom: number) => ({ borderWidth: `${2 / zoom}px` }));
  function Sample() {
    const ref = useZoomStyledRef<HTMLDivElement>(styles);
    return <div ref={ref} data-testid="scaled" />;
  }
  const mounted = render(<React.StrictMode><Sample /></React.StrictMode>);
  const element = screen.getByTestId("scaled");
  expect(element.style.borderWidth).toBe("1px");
  styles.mockClear();
  act(() => viewport.setScroll(new Pt(20, 30)));
  expect(styles).not.toHaveBeenCalled();
  act(() => viewport.enqueueTransform(4, Pt.zero(), false));
  expect(styles).toHaveBeenCalledOnce();
  expect(element.style.borderWidth).toBe("0.5px");
  const next = ensure(createViewportFixture(0.5).viewportCtx, "New viewport");
  act(() => { owner.viewportCtx = next; });
  expect(element.style.borderWidth).toBe("4px");
  styles.mockClear();
  act(() => viewport.enqueueTransform(3, Pt.zero(), false));
  expect(styles).not.toHaveBeenCalled();
  act(() => next.enqueueTransform(2, Pt.zero(), false));
  expect(element.style.borderWidth).toBe("1px");
  mounted.unmount();
  styles.mockClear();
  act(() => { next.enqueueTransform(5, Pt.zero(), false); owner.viewportCtx = null; });
  expect(styles).not.toHaveBeenCalled();
});

it("uses the native empty viewport default and refreshes React style inputs without a zoom event", () => {
  const { owner } = setup();
  owner.viewportCtx = null;
  function Sample({ gap }: { gap: number }) {
    const ref = useZoomStyledRef<HTMLDivElement>((zoom) => ({ marginLeft: `${gap / zoom}px` }));
    return <div ref={ref} data-testid="scaled" />;
  }
  const mounted = render(<Sample gap={10} />);
  expect(screen.getByTestId("scaled").style.marginLeft).toBe("10px");
  mounted.rerender(<Sample gap={20} />);
  expect(screen.getByTestId("scaled").style.marginLeft).toBe("20px");
  act(() => { owner.viewportCtx = ensure(createViewportFixture(2).viewportCtx, "Viewport"); });
  expect(screen.getByTestId("scaled").style.marginLeft).toBe("10px");
});

it("refreshes the scaling callback when disabled props change at the same zoom", () => {
  setup(2);
  function Sample({ disabled }: { disabled: boolean }) {
    const ref = useScaledElementRef<HTMLDivElement>({ minZoom: 1, extraTransformation: "rotate(90deg)", disableScaling: disabled });
    return <div ref={ref} data-testid="scaled" />;
  }
  const mounted = render(<Sample disabled={true} />);
  expect(screen.getByTestId("scaled").style.transform).toBe("");
  mounted.rerender(<Sample disabled={false} />);
  expect(screen.getByTestId("scaled").style.transform).toBe("scale(0.5) rotate(90deg)");
});
