import { createCache, StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider } from "antd";
import zhCN from "antd/es/locale/zh_CN";
import React, { useMemo } from "react";

/** Host React controls render into Studio's document, including CSS and portals. */
export function StudioControlsProvider({ studioDocument, children }: {
  studioDocument: Document;
  children?: React.ReactNode;
}) {
  const cache = useMemo(() => createCache(), [studioDocument]);
  return <StyleProvider container={studioDocument.head} cache={cache}>
    <ConfigProvider locale={zhCN}
      theme={{ cssVar: { key: "studio-prop-controls" } }}
      getPopupContainer={() => studioDocument.body}
      getTargetContainer={() => studioDocument.body}>
      {children}
    </ConfigProvider>
  </StyleProvider>;
}
