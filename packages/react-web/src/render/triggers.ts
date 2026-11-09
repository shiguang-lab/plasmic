import {
  FocusRingAria,
  useFocusRing as useAriaFocusRing,
} from "@react-aria/focus";
import {
  HoverResult,
  PressResult,
  useHover as useAriaHover,
  usePress as useAriaPress,
} from "@react-aria/interactions";

type FocusHookResult = [boolean, FocusRingAria["focusProps"]];
type HoverHookResult = [boolean, HoverResult["hoverProps"]];
type PressHookResult = [boolean, PressResult["pressProps"]];

export function useFocused(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocused, focusProps } = useAriaFocusRing({
    within: false,
    isTextInput: opts.isTextInput,
  });

  return [isFocused, focusProps];
}

export function useFocusVisible(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocusVisible, focusProps } = useAriaFocusRing({
    within: false,
    isTextInput: opts.isTextInput,
  });

  return [isFocusVisible, focusProps];
}

export function useFocusedWithin(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocused, focusProps } = useAriaFocusRing({
    within: true,
    isTextInput: opts.isTextInput,
  });

  return [isFocused, focusProps];
}

export function useFocusVisibleWithin(opts: {
  isTextInput?: boolean;
}): FocusHookResult {
  const { isFocusVisible, focusProps } = useAriaFocusRing({
    within: true,
    isTextInput: opts.isTextInput,
  });

  return [isFocusVisible, focusProps];
}

export function useHover(): HoverHookResult {
  const { isHovered, hoverProps } = useAriaHover({});
  return [isHovered, hoverProps];
}

export function usePressed(): PressHookResult {
  const { isPressed, pressProps } = useAriaPress({
    onPress: (e) => e.continuePropagation(),
    onPressStart: (e) => e.continuePropagation(),
    onPressEnd: (e) => e.continuePropagation(),
    onPressUp: (e) => e.continuePropagation(),
  });
  return [isPressed, pressProps];
}
