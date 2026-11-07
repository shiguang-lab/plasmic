import { useInspectorTheme } from "@/wab/client/components/coding/useInspectorTheme";
import React from "react";
import { ObjectInspector } from "react-inspector";

export function ValueViewer({
  value,
  expandFully = false,
}: {
  value: unknown;
  expandFully?: boolean;
}) {
  const inspectorTheme = useInspectorTheme();
  return (
    <ObjectInspector
      theme={inspectorTheme}
      data={value}
      expandLevel={expandFully ? 99 : undefined}
    />
  );
}

export default ValueViewer;
