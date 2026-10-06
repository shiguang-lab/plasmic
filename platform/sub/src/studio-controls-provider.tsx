import { createCache, StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider } from "antd";
import enUS from "antd/es/locale/en_US";
import React, { useMemo } from "react";

/** Host React controls render into Studio's document, including CSS and portals. */
export function StudioControlsProvider({ studioDocument, children }: {
  studioDocument: Document;
  children?: React.ReactNode;
}) {
  const cache = useMemo(() => createCache(), [studioDocument]);
  return <StyleProvider container={studioDocument.head} cache={cache}>
    <ConfigProvider locale={enUS}
      theme={{ cssVar: { key: "studio-prop-controls" } }}
      getPopupContainer={() => studioDocument.body}
      getTargetContainer={() => studioDocument.body}>
      {children}
    </ConfigProvider>
  </StyleProvider>;
}
