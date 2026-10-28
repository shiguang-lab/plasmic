import cn from "classnames";
import React from "react";

export type SvgIcon = React.ComponentType<React.ComponentProps<"svg">>;

export type IconProps = Omit<React.ComponentProps<"svg">, "ref"> & {
  monochromeExempt?: boolean;
  icon: SvgIcon;
  size?: number | string;
};

const FORWARD_REF = Symbol.for("react.forward_ref");

/** A plain function component (not a class, memo or forwardRef object). */
function isFunctionComponent(
  type: unknown,
): type is (props: React.ComponentPropsWithoutRef<"svg">) => React.ReactNode {
  return (
    typeof type === "function" &&
    !(type as { prototype?: { isReactComponent?: unknown } }).prototype
      ?.isReactComponent
  );
}

// Stable per-icon keys, so `SvgWithRef` remounts when the icon changes and
// each icon's render keeps its own hook state.
const iconKeys = new WeakMap<object, string>();
let nextIconKey = 0;
function iconKey(icon: object) {
  let key = iconKeys.get(icon);
  if (!key) {
    key = `icon-${nextIconKey++}`;
    iconKeys.set(icon, key);
  }
  return key;
}

/** Fallback anchor for icons whose root can't take a ref. */
const AnchorSpan = React.forwardRef<Element, { children: React.ReactNode }>(
  function AnchorSpan({ children }, ref) {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        style={{ display: "inline-flex", flexShrink: 0 }}
      >
        {children}
      </span>
    );
  },
);

/**
 * Renders a function icon and attaches `innerRef` to the host element it
 * returns. Generated icons render an `<svg>` with no hooks and drop refs, so
 * this puts the ref on that `<svg>` without adding any DOM.
 */
function SvgWithRef({
  render,
  svgProps,
  innerRef,
}: {
  render: (props: React.ComponentPropsWithoutRef<"svg">) => React.ReactNode;
  svgProps: React.ComponentPropsWithoutRef<"svg">;
  innerRef: React.Ref<Element>;
}) {
  const element = render(svgProps);
  if (React.isValidElement(element) && typeof element.type === "string") {
    return React.cloneElement(element as React.ReactElement<any>, {
      ref: innerRef,
    });
  }
  return <AnchorSpan ref={innerRef}>{element}</AnchorSpan>;
}

/**
 * Renders a generated SVG icon.
 *
 * Generated icons are plain function components and can't take refs. When a
 * parent asks for one (antd Tooltip/Popover/Dropdown triggers do, to measure
 * the anchor and to tell clicks on it from outside clicks), the ref is put on
 * the icon's own `<svg>`, so the DOM, classes and styles stay exactly as
 * without a ref. Only icons that render something other than a host element
 * get a wrapping `<span>` as anchor.
 */
export const Icon = React.forwardRef<Element, IconProps>(
  function Icon(props, ref) {
    const {
      icon,
      className,
      monochromeExempt,
      size = 16,
      style,
      ...rest
    } = props;
    const IconType = icon;
    const svgProps: React.ComponentPropsWithoutRef<"svg"> = {
      className: cn(`custom-svg-icon`, className, {
        "monochrome-exempt": monochromeExempt,
      }),
      style: {
        width: size,
        height: size,
        ...style,
      },
      ...rest,
    };

    if (!ref) {
      return <IconType {...svgProps} />;
    }
    if ((IconType as { $$typeof?: symbol }).$$typeof === FORWARD_REF) {
      const RefIcon = IconType as unknown as React.ComponentType<
        React.ComponentPropsWithoutRef<"svg"> & React.RefAttributes<Element>
      >;
      return <RefIcon {...svgProps} ref={ref} />;
    }
    if (isFunctionComponent(IconType)) {
      return (
        <SvgWithRef
          key={iconKey(IconType)}
          render={IconType}
          svgProps={svgProps}
          innerRef={ref}
        />
      );
    }
    return (
      <AnchorSpan ref={ref}>
        <IconType {...svgProps} />
      </AnchorSpan>
    );
  },
);
