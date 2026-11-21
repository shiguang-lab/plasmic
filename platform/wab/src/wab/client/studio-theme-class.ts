import { ConfigProvider, theme } from "antd";
import { useContext } from "react";

/** Make the current Ant Design tokens available to non-Ant components and portals. */
export function useStudioThemeClass() {
  theme.useToken();
  return (
    useContext(ConfigProvider.ConfigContext).theme?.cssVar?.key ??
    "css-var-root"
  );
}
