import * as React from "react";

/** Each Studio model keeps a stable React type while the executable bridge and
 * its Compiler cache belong to the iframe that renders that model. */
export function createCanvasComponentType<Props extends object, Ref = unknown>(render: (props: React.PropsWithoutRef<Props>, ref: React.ForwardedRef<Ref>) => React.ReactNode) {
  return React.forwardRef<Ref, Props>(function CanvasModelComponent(props, ref) {
    "use memo";
    return render(props, ref);
  });
}

/** Extra model/env props are read by the Studio collector from this fiber. */
export function CanvasWrapper({ children }: { children?: React.ReactNode; [prop: string]: any }) {
  return <>{children}</>;
}

export function CanvasIcon({ outerHTML, className, placeholderUrl, ...props }: React.ComponentProps<"svg"> & { outerHTML: string; placeholderUrl: string }) {
  return outerHTML
    ? <div {...props as React.ComponentProps<"div">} className={`${className} svg-icon-wrapper`} dangerouslySetInnerHTML={{ __html: outerHTML }} />
    : <img {...props as React.ComponentProps<"img">} className={className} src={placeholderUrl} />;
}
