import MuiAccordion from "@mui/material/Accordion";
import MuiAutocomplete, { AutocompleteProps } from "@mui/material/Autocomplete";
import MuiBottomNavigation from "@mui/material/BottomNavigation";
import MuiDialog from "@mui/material/Dialog";
import MuiDrawer from "@mui/material/Drawer";
import MuiMenu from "@mui/material/Menu";
import NativeNativeSelect from "@mui/material/NativeSelect";
import NativeSelectInput from "@mui/material/Select";
import NativeSnackbar from "@mui/material/Snackbar";
import MuiStepButton from "@mui/material/StepButton";
import NativeStepper from "@mui/material/Stepper";
import { createTheme, ThemeOptions, ThemeProvider } from "@mui/material/styles";
import MuiSwipeableDrawer from "@mui/material/SwipeableDrawer";
import MuiTabs from "@mui/material/Tabs";
import MuiTextField, { TextFieldProps } from "@mui/material/TextField";
import MuiTooltip from "@mui/material/Tooltip";
import { mergeSlotProps } from "@mui/material/utils";
import {
  PlasmicCanvasProps,
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import React from "react";
export * from "./native";
export * from "./stateHelpers";

import { renderSlot, withSlots } from "./slots";

const MuiSelect = withSlots(NativeSelectInput, ["input"]);
const MuiNativeSelect = withSlots(NativeNativeSelect, ["input"]);
const MuiSnackbar = withSlots(NativeSnackbar, ["children"]);
const MuiStepper = withSlots(NativeStepper, ["connector"]);

type OverlayExtras = PlasmicCanvasProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};
type OverlayNativeProps = {
  open?: boolean;
  children?: React.ReactNode;
  onClose?: (...args: any[]) => void;
  onOpen?: (...args: any[]) => void;
};
function overlay<P extends OverlayNativeProps>(Native: React.ComponentType<P>) {
  return function MaterialOverlay(
    props: Omit<P, "open" | "onOpen" | "onClose"> & {
      open?: boolean;
      onClose?: P["onClose"];
      onOpen?: P["onOpen"];
      ref?: React.Ref<unknown>;
    } & OverlayExtras,
  ) {
    const {
      __canvas,
      defaultOpen = false,
      open,
      onOpenChange,
      onClose,
      onOpen,
      ...rest
    } = props;
    const canvas = usePlasmicCanvasContext();
    const info = usePlasmicCanvasComponentInfo(props);
    const [localOpen, setLocalOpen] = React.useState(defaultOpen);
    const state = canvas
      ? info?.getState?.("open", open, defaultOpen)
      : undefined;
    const editing = !!canvas && !canvas.interactive;
    const selected =
      !!info?.selected &&
      (Native !== (MuiTooltip as React.ComponentType<any>) ||
        info.slot !== "children");
    const effectiveOpen = state
      ? !!state.value
      : canvas && selected
        ? true
        : (open ?? localOpen);
    const change = (next: boolean, callback: typeof onClose, args: any[]) => {
      if (editing) {
        state?.set(next);
        return;
      }
      setLocalOpen(next);
      state?.set(next);
      onOpenChange?.(next);
      callback?.(...args);
    };
    // Revealing a hidden overlay must not run business transition callbacks.
    const silent =
      editing || !!state?.revealed || (!!canvas && selected && !state && !open);
    const nativeProps = { ...rest } as P & {
      onTransitionEnter?: () => void;
      onTransitionExited?: () => void;
      slotProps?: Record<string, any>;
    };
    if (silent) {
      delete nativeProps.onTransitionEnter;
      delete nativeProps.onTransitionExited;
      const transition = nativeProps.slotProps?.transition;
      if (transition) {
        const withoutLifecycle = (value: Record<string, unknown>) => {
          const result = { ...value };
          for (const key of [
            "onEnter",
            "onEntering",
            "onEntered",
            "onExit",
            "onExiting",
            "onExited",
          ])
            delete result[key];
          return result;
        };
        nativeProps.slotProps = {
          ...nativeProps.slotProps,
          transition:
            typeof transition === "function"
              ? (...args: unknown[]) => withoutLifecycle(transition(...args))
              : withoutLifecycle(transition),
        };
      }
    }
    return (
      <Native
        {...nativeProps}
        open={effectiveOpen}
        {...(editing &&
        Native !== (MuiTooltip as React.ComponentType<any>) &&
        Native !== MuiSnackbar
          ? {
              disableAutoFocus: true,
              disableEnforceFocus: true,
              disableRestoreFocus: true,
            }
          : {})}
        {...(editing && Native === MuiSnackbar
          ? { autoHideDuration: null }
          : {})}
        onClose={(...args: any[]) => change(false, onClose, args)}
        {...(Native === (MuiTooltip as React.ComponentType<any>) ||
        Native === MuiSwipeableDrawer
          ? { onOpen: (...args: any[]) => change(true, onOpen, args) }
          : {})}
      />
    );
  };
}
export const Dialog = overlay(MuiDialog);
export const Drawer = overlay(MuiDrawer);
export const SwipeableDrawer = overlay(MuiSwipeableDrawer);
export const Snackbar = overlay(MuiSnackbar);
const MenuOverlay = overlay(MuiMenu);
export const Menu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MenuOverlay>
>(function Menu(props, ref) {
  return renderSlot(props.children, (children) => (
    <MenuOverlay {...props} ref={ref} children={children} />
  ));
});
const TooltipOverlay = overlay(MuiTooltip);
export const Tooltip = React.forwardRef<
  HTMLElement,
  React.ComponentProps<typeof TooltipOverlay>
>(function Tooltip(props, ref) {
  return renderSlot(props.children, (children) => {
    const items = React.Children.toArray(children);
    const child =
      items.length === 1 && React.isValidElement(items[0]) ? (
        items[0]
      ) : (
        <span>{children}</span>
      );
    return <TooltipOverlay {...props} ref={ref} children={child} />;
  });
});

export const NativeOption = React.forwardRef<
  HTMLOptionElement,
  React.ComponentProps<"option">
>(function NativeOption(props, ref) {
  return <option {...props} ref={ref} />;
});

function navigation<
  P extends {
    value?: any;
    children?: React.ReactNode;
    onChange?: (event: React.SyntheticEvent, value: any) => void;
  },
>(Native: React.ComponentType<P>) {
  return React.forwardRef<
    HTMLDivElement,
    P & { defaultValue?: any } & PlasmicCanvasProps
  >(function MaterialNavigation(input, ref) {
    const {
      __canvas,
      defaultValue = 0,
      value,
      onChange,
      children,
      ...rest
    } = input as P & { defaultValue?: any } & PlasmicCanvasProps;
    const [localValue, setLocalValue] = React.useState(defaultValue);
    const canvas = usePlasmicCanvasContext();
    const state = canvas
      ? __canvas?.getState?.("value", value, defaultValue)
      : undefined;
    return renderSlot(children, (items) => (
      <Native
        {...(rest as P)}
        ref={ref as any}
        value={state ? state.value : value !== undefined ? value : localValue}
        onChange={(event, next) => {
          setLocalValue(next);
          state?.set(next);
          if (!canvas || canvas.interactive) {
            onChange?.(event, next);
          }
        }}
        children={items}
      />
    ));
  });
}
export const Tabs = navigation(MuiTabs);
export const BottomNavigation = navigation(MuiBottomNavigation);
export const Select = Object.assign(
  React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MuiSelect>>(
    function Select(props, ref) {
      return renderSlot(props.children, (children) => (
        <MuiSelect {...props} ref={ref} children={children} />
      ));
    },
  ),
  { muiName: "Select" },
);
export const NativeSelect = Object.assign(
  React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof MuiNativeSelect>
  >(function NativeSelect(props, ref) {
    return renderSlot(props.children, (children) => (
      <MuiNativeSelect {...props} ref={ref} children={children} />
    ));
  }),
  { muiName: "Select" },
);

function renderStepButton(
  props: React.ComponentProps<typeof MuiStepButton>,
  render: (button: React.ReactElement) => React.ReactElement,
) {
  return renderSlot(props.children, (children) => {
    const items = React.Children.toArray(children);
    return render(
      <MuiStepButton
        {...props}
        children={items.length === 1 ? items[0] : items}
      />,
    );
  });
}
export const StepButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof MuiStepButton>
>((props, ref) => renderStepButton({ ...props, ref }, (button) => button));

export const Stepper = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof NativeStepper>
>((props, ref) =>
  renderSlot(props.children, (children) => {
    const steps = React.Children.toArray(children);
    // MUI checks StepButton's exact identity before establishing keyboard
    // navigation. Resolve its editable slots before passing the Step tree in.
    const resolveStep = (
      index: number,
      resolved: React.ReactNode[],
    ): React.ReactElement => {
      if (index === steps.length)
        return <MuiStepper {...props} ref={ref} children={resolved} />;
      const step = steps[index];
      if (!React.isValidElement<{ children?: React.ReactNode }>(step))
        return resolveStep(index + 1, [...resolved, step]);
      if (step.type === StepButton)
        return renderStepButton(step.props, (button) =>
          resolveStep(index + 1, [
            ...resolved,
            React.cloneElement(button, { key: step.key }),
          ]),
        );
      return renderSlot(step.props.children, (content) => {
        const parts = React.Children.toArray(content);
        const resolvePart = (
          partIndex: number,
          contents: React.ReactNode[],
        ): React.ReactElement => {
          if (partIndex === parts.length)
            return resolveStep(index + 1, [
              ...resolved,
              React.cloneElement(step, { children: contents }),
            ]);
          const part = parts[partIndex];
          if (
            React.isValidElement<React.ComponentProps<typeof MuiStepButton>>(
              part,
            ) &&
            part.type === StepButton
          ) {
            return renderStepButton(part.props, (button) =>
              resolvePart(partIndex + 1, [
                ...contents,
                React.cloneElement(button, { key: part.key }),
              ]),
            );
          }
          return resolvePart(partIndex + 1, [...contents, part]);
        };
        return resolvePart(0, []);
      });
    };
    return resolveStep(0, []);
  }),
);
export const Accordion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MuiAccordion> & PlasmicCanvasProps
>(function Accordion(props, ref) {
  const { __canvas, ...rest } = props;
  const canvas = usePlasmicCanvasContext();
  const state = canvas
    ? __canvas?.getState?.("expanded", props.expanded, props.defaultExpanded)
    : undefined;
  return renderSlot(props.children, (children) => (
    <MuiAccordion
      {...rest}
      ref={ref}
      {...(state
        ? { expanded: !!state.value }
        : canvas && __canvas?.selected
          ? { expanded: true }
          : {})}
      onChange={(event, expanded) => {
        state?.set(expanded);
        if (!canvas || canvas.interactive) {
          props.onChange?.(event, expanded);
        }
      }}
      children={children ?? []}
    />
  ));
});

type MobileAutocompleteProps = Omit<
  AutocompleteProps<any, boolean, boolean, boolean>,
  "renderInput"
> & {
  renderInput?: AutocompleteProps<
    any,
    boolean,
    boolean,
    boolean
  >["renderInput"];
  textFieldProps?: TextFieldProps;
};
export const Autocomplete = React.forwardRef<
  HTMLDivElement,
  MobileAutocompleteProps
>(function Autocomplete({ textFieldProps, renderInput, ...props }, ref) {
  return (
    <MuiAutocomplete
      {...props}
      ref={ref}
      renderInput={
        renderInput ??
        ((params) => (
          <MuiTextField
            {...textFieldProps}
            {...params}
            slotProps={{
              ...textFieldProps?.slotProps,
              // Autocomplete owns refs, ARIA and adornments. Compose native handlers
              // and classes with configured TextField slots instead of discarding them.
              inputLabel: mergeSlotProps(
                params.slotProps.inputLabel,
                textFieldProps?.slotProps?.inputLabel ?? {},
              ),
              input: mergeSlotProps(
                params.slotProps.input,
                textFieldProps?.slotProps?.input ?? {},
              ),
              htmlInput: mergeSlotProps(
                params.slotProps.htmlInput,
                textFieldProps?.slotProps?.htmlInput ?? {},
              ),
            }}
          />
        ))
      }
    />
  );
});

export function MaterialThemeProvider({
  theme,
  children,
}: {
  theme?: ThemeOptions;
  children?: React.ReactNode;
}) {
  const resolvedTheme = React.useMemo(() => createTheme(theme ?? {}), [theme]);
  return <ThemeProvider theme={resolvedTheme}>{children}</ThemeProvider>;
}
