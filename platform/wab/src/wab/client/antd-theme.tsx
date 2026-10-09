import { useI18n } from "@/wab/client/i18n";
import type { ThemeConfig } from "antd";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import * as React from "react";

// Port of the antd v4 less variables from antd-overrides.less.
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#04a4f4",
    colorText: "#1B1B18",
    colorTextSecondary: "#706f6c",
    colorBgContainer: "#fff",
    // Tooltip background; v4 set this on .ant-tooltip-inner in main.sass.
    colorBgSpotlight: "#1B1B18",
    fontFamily:
      '"Inter", "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 12,
    lineHeight: 1.5,
  },
  components: {
    Modal: {
      wireframe: true,
    },
  },
};

export function AntdConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useI18n();
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <ConfigProvider
      theme={antdTheme}
      locale={
        { en: enUS, "zh-CN": zhCN, "zh-TW": zhTW, ja: jaJP, ko: koKR }[locale]
      }
    >
      {children}
    </ConfigProvider>
  );
}

// Static notification/message/Modal.confirm calls render in their own React
// root and don't see <ConfigProvider>, but they do read the global config.
export function configureAntdStatics() {
  ConfigProvider.config({ theme: antdTheme });
}
