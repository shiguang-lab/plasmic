import { usePlasmicLinkMaybe } from "@plasmicapp/host";
import React from "react";
import { omit, pick } from "../common";

// These props are used internally by PlasmicLink to determine how to render the link
const INTERNAL_PROPS = ["component", "platform", "legacyBehavior"] as const;

export const PlasmicLink = React.forwardRef(function PlasmicLinkContent(
  props: any,
  ref: React.Ref<any>
) {
  const Link = usePlasmicLinkMaybe() ?? PlasmicLinkInternal;
  if (Link === PlasmicLink || Link === PlasmicLinkInternal) {
    // Just in case, break the cycle
    return <PlasmicLinkInternal {...props} ref={ref} />;
  } else {
    // Don't pass internal props (component/platform/legacyBehavior) to non-PlasmicLinkInternal
    // eslint-disable-next-line react/forbid-elements
    return <Link {...omit(props, ...INTERNAL_PROPS)} ref={ref} />;
  }
});

export const PlasmicLinkInternal = React.forwardRef(
  function PlasmicLinkInternal(props: any, ref: React.Ref<any>) {
    const Component = props.component;
    // props.href is required for nextjs; if no props.href,
    // then we just render the default anchor element
    if (props.platform === "nextjs" && props.href) {
      const nextjsProps = [
        "href",
        "replace",
        "scroll",
        "shallow",
        "passHref",
        "prefetch",
        "locale",
      ];

      // If this is a fragment identifier link, then we set
      // scroll={false} so that smooth scrolling works
      const isFragment = props.href?.startsWith("#");

      // Default to legacy behavior (nested <a> tag) unless legacyBehavior
      // is explicitly set to false. Older codegen may not set this prop at
      // all, so we treat undefined as legacy for backwards compatibility.
      // https://github.com/plasmicapp/plasmic-internal/pull/2203#issuecomment-3877931788
      if (props.legacyBehavior !== false) {
        return React.createElement(
          props.component,
          {
            scroll: !isFragment,
            legacyBehavior: true,
            ...pick(props, ...nextjsProps),
          },
          <a {...omit(props, ...INTERNAL_PROPS, ...nextjsProps)} ref={ref} />
        );
      }

      // pass props directly to Link (no nested <a>)
      return <Component scroll={!isFragment} {...omit(props, ...INTERNAL_PROPS)} ref={ref} />;
    }


    if (props.platform === "tanstack" && isInternalHref(props.href)) {
      return <Component {...omit(props, ...INTERNAL_PROPS, "href")} to={props.href} ref={ref} />;
    }

    return <a {...omit(props, ...INTERNAL_PROPS)} ref={ref} />;
  }
);

function isInternalHref(href: string): boolean {
  return /^\/(?!\/)/.test(href);
}
