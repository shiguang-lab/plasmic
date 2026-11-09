import { createCache, StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider, type ThemeConfig } from "antd";
import enUS from "antd/es/locale/en_US";
import React, { useMemo } from "react";

function createStudioControlsBinding(studioDocument: Document) {
  return { studioDocument, cache: createCache() };
}

/** Host React controls render into Studio's document, including CSS and portals. */
export function StudioControlsProvider({ studioDocument, theme, children }: {
  studioDocument: Document;
  theme: ThemeConfig | undefined;
  children?: React.ReactNode;
}) {
  const binding = useMemo(() => createStudioControlsBinding(studioDocument), [studioDocument]);
  // CSS-in-JS hooks retain their cache for the mounted fiber's lifetime.
  return <StyleProvider key={binding.cache.instanceId} container={binding.studioDocument.head} cache={binding.cache}>
    <ConfigProvider locale={enUS}
      theme={{ ...theme, cssVar: { key: "studio-prop-controls" } }}
      getPopupContainer={() => binding.studioDocument.body}
      getTargetContainer={() => binding.studioDocument.body}>
      {children}
    </ConfigProvider>
  </StyleProvider>;
}
