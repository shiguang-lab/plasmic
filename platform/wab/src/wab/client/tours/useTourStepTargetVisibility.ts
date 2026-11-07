import React from "react";

const TOUR_STEP_VISIBILITY_CHECK_INTERVAL = 1500;

// Keep a tour off the page until its target is laid out. In particular, a
// missing/hidden target must not turn Joyride's target wait into a page overlay.
export function useTourStepTargetVisibility(
  isTourRunning: boolean,
  target?: string,
  onVisibilityChange?: (isVisible: boolean) => void,
) {
  const [visibility, setVisibility] = React.useState({ target, visible: false });
  const wasVisible = React.useRef(false);

  React.useEffect(() => {
    if (!isTourRunning || !target) {
      return;
    }
    const checkVisibility = () => {
      const element = document.querySelector(target);
      const rect = element?.getBoundingClientRect();
      let visible = !!rect && rect.width > 0 && rect.height > 0;
      for (let parent = element; visible && parent; parent = parent.parentElement) {
        const { display, visibility: cssVisibility } = getComputedStyle(parent);
        visible = display !== "none" && cssVisibility !== "hidden" && cssVisibility !== "collapse";
      }
      if (visible !== wasVisible.current) {
        onVisibilityChange?.(visible);
        wasVisible.current = visible;
      }
      setVisibility((previous) => previous.target === target && previous.visible === visible
        ? previous
        : { target, visible });
    };
    checkVisibility();
    const interval = setInterval(checkVisibility, TOUR_STEP_VISIBILITY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [isTourRunning, target, onVisibilityChange]);

  return { isTargetVisible: isTourRunning && visibility.target === target && visibility.visible };
}
