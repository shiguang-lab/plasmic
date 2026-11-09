import * as React from "react";
import {
  PlasmicClassMetadata,
  ButtonRef,
  deriveButtonProps,
  useCheckbox,
  useSwitch,
  useTextInput,
  useMenu,
  useMenuButton,
  useMenuItem,
  useMenuGroup,
  useSelect,
  useSelectOption,
  useSelectOptionGroup,
  getDefaultPlasmicProps,
  PLUME_STRICT_MODE,
  MenuContext,
  SelectContext,
} from "@plasmicapp/react-web";

export interface CanvasPlumeProps<Config, ForwardedRef = undefined> {
  impl: React.ElementType;
  metadata: PlasmicClassMetadata;
  componentProps: Record<string, any>;
  internalProps: Record<string, any>;
  config: Config;
  forwardedRef?: ForwardedRef;
  defaultSlot?: string;
}

function renderPlumeImplementation(props: CanvasPlumeProps<unknown, unknown>, plasmicProps: { args?: Record<string, any>; [key: string]: any }) {
  if (props.defaultSlot) {
    if (plasmicProps.args?.[props.defaultSlot] !== props.componentProps[props.defaultSlot]) {
      throw new Error("Expected default slot content to match its canvas stub");
    }
    const args = Object.fromEntries(Object.entries(plasmicProps.args ?? {}).filter(([name]) => name !== props.defaultSlot));
    return React.createElement(props.impl, { ...plasmicProps, args, ...props.internalProps });
  }
  return React.createElement(props.impl, { ...plasmicProps, ...props.internalProps });
}

export function CanvasPlumeButton(props: CanvasPlumeProps<Parameters<typeof deriveButtonProps>[2], ButtonRef>) {
  const { plasmicProps, rootOverride } = deriveButtonProps(props.metadata, props.componentProps, props.config);
  const Impl = props.impl;
  const root = props.config.root;
  return <Impl {...plasmicProps} {...props.internalProps} overrides={{
    ...plasmicProps.overrides,
    [root]: { ...rootOverride, props: { ...rootOverride.props, ref: props.forwardedRef } },
  }} />;
}
export function CanvasPlumeCheckbox(props: CanvasPlumeProps<Parameters<typeof useCheckbox>[2], Parameters<typeof useCheckbox>[3]>) {
  const { plasmicProps } = useCheckbox(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeSwitch(props: CanvasPlumeProps<Parameters<typeof useSwitch>[2], Parameters<typeof useSwitch>[3]>) {
  const { plasmicProps } = useSwitch(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeTextInput(props: CanvasPlumeProps<Parameters<typeof useTextInput>[2], Parameters<typeof useTextInput>[3]>) {
  const { plasmicProps } = useTextInput(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeMenu(props: CanvasPlumeProps<Parameters<typeof useMenu>[2], Parameters<typeof useMenu>[3]>) {
  const { plasmicProps } = useMenu(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeMenuButton(props: CanvasPlumeProps<Parameters<typeof useMenuButton>[2], Parameters<typeof useMenuButton>[3]>) {
  const { plasmicProps } = useMenuButton(props.metadata, { ...props.componentProps, menu: props.componentProps.menu }, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeMenuGroup(props: CanvasPlumeProps<Parameters<typeof useMenuGroup>[2]>) {
  const { plasmicProps } = useMenuGroup(props.metadata, props.componentProps, props.config);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeSelect(props: CanvasPlumeProps<Parameters<typeof useSelect>[2], Parameters<typeof useSelect>[3]>) {
  const { plasmicProps } = useSelect(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeSelectOptionGroup(props: CanvasPlumeProps<Parameters<typeof useSelectOptionGroup>[2]>) {
  const { plasmicProps } = useSelectOptionGroup(props.metadata, props.componentProps, props.config);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeMenuItem(props: CanvasPlumeProps<Parameters<typeof useMenuItem>[2]>) {
  const context = React.useContext(MenuContext);
  if (!context) {
    if (PLUME_STRICT_MODE) { throw new Error("You can only use a Menu.Item within a Menu component."); }
    return renderPlumeImplementation(props, getDefaultPlasmicProps(props.metadata, props.componentProps).plasmicProps);
  }
  return <CanvasPlumeMenuItemWithContext {...props} />;
}
function CanvasPlumeMenuItemWithContext(props: CanvasPlumeProps<Parameters<typeof useMenuItem>[2]>) {
  const { plasmicProps } = useMenuItem(props.metadata, props.componentProps, props.config);
  return renderPlumeImplementation(props, plasmicProps);
}
export function CanvasPlumeSelectOption(props: CanvasPlumeProps<Parameters<typeof useSelectOption>[2], Parameters<typeof useSelectOption>[3]>) {
  const context = React.useContext(SelectContext);
  if (!context) {
    if (PLUME_STRICT_MODE) { throw new Error("You can only use a Select.Option within a Select component."); }
    return renderPlumeImplementation(props, getDefaultPlasmicProps(props.metadata, props.componentProps).plasmicProps);
  }
  return <CanvasPlumeSelectOptionWithContext {...props} />;
}
function CanvasPlumeSelectOptionWithContext(props: CanvasPlumeProps<Parameters<typeof useSelectOption>[2], Parameters<typeof useSelectOption>[3]>) {
  const { plasmicProps } = useSelectOption(props.metadata, props.componentProps, props.config, props.forwardedRef);
  return renderPlumeImplementation(props, plasmicProps);
}
