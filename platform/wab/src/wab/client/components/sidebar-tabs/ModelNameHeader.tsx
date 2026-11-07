import { NamedPanelHeader } from "@/wab/client/components/sidebar/sidebar-helpers";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ComponentProps } from "react";
import React from "react";
import { useStore } from "zustand";

/** The model name enters the compiled Inspector through an immutable field. */
export function ModelNameHeader({
  nameStore,
  ...props
}: Omit<ComponentProps<typeof NamedPanelHeader>, "value"> & {
  nameStore: ModelFieldStore<string | null | undefined>;
}) {
  "use memo";
  const name = useStore(nameStore);
  return <NamedPanelHeader {...props} value={name || ""} />;
}
