import * as React from "react";

/** Every invocation of a native render slot owns its stable instance identity. */
export function CanvasRenderSlot({ render }: { readonly render: (instance: string) => React.ReactNode }) {
  const instance = React.useId();
  return render(instance);
}
