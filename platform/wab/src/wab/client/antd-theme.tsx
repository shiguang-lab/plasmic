import { useI18n } from "@/wab/client/i18n";
import {
  UiAppearance,
  useUiAppearance,
  usesProductTheme,
} from "@/wab/client/ui-theme";
import type { ThemeConfig } from "antd";
import { theme as AntdTheme, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";
import * as React from "react";
import productStyles from "./product-ui-theme.module.less";

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

// Independent modal roots share the document theme with the application shell.
const productThemeRoots = new Map<string, number>();

export function AntdConfigProvider({
  children,
  productUI = usesProductTheme(window.location.pathname),
}: {
  children: React.ReactNode;
  productUI?: boolean;
}) {
  const { locale } = useI18n();
  const { appearance } = useUiAppearance();
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const currentTheme = productUI ? productTheme(appearance) : antdTheme;
  const tokenClass = productUI ? `studio-${appearance}` : "studio-classic";
  const platformClass = navigator.userAgent.includes("PlasmicDesktop/darwin")
    ? productStyles.macDesktop
    : navigator.userAgent.includes("PlasmicDesktop/win32")
      ? productStyles.windowsDesktop
      : undefined;
  // Portals can leave the themed body/editor subtree. Bind the palette to
  // every popup root so legacy controls inside inherit it in any container.
  const popupClassNames = productUI
    ? { root: productStyles.root + " " + tokenClass }
    : undefined;
  React.useLayoutEffect(() => {
    const classes = [
      tokenClass,
      ...(productUI ? [productStyles.root] : []),
      ...(platformClass ? [platformClass] : []),
    ];
    for (const name of classes) {
      productThemeRoots.set(name, (productThemeRoots.get(name) ?? 0) + 1);
      document.documentElement.classList.add(name);
    }
    return () => {
      for (const name of classes) {
        const count = productThemeRoots.get(name)! - 1;
        if (count) productThemeRoots.set(name, count);
        else {
          productThemeRoots.delete(name);
          document.documentElement.classList.remove(name);
        }
      }
    };
  }, [productUI, tokenClass, platformClass]);
  React.useLayoutEffect(() => {
    ConfigProvider.config({
      theme: { ...currentTheme, cssVar: { key: tokenClass } },
    });
    // Document/loading colors follow the selected appearance even on auth
    // routes and in independent modal roots that use the legacy control theme.
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    const root = document.documentElement;
    for (const [name, value] of Object.entries({
      layout: token.colorBgLayout,
      surface: token.colorBgContainer,
      muted: token.colorTextSecondary,
      border: token.colorBorderSecondary,
      fill: token.colorFillSecondary,
    })) {
      root.style.setProperty(`--studio-loading-${name}`, value);
    }
  }, [productUI, appearance, tokenClass]);
  return (
    <ConfigProvider
      theme={{ ...currentTheme, cssVar: { key: tokenClass } }}
      tooltip={{ arrow: false, classNames: popupClassNames }}
      popover={{ arrow: false, classNames: popupClassNames }}
      dropdown={{ classNames: popupClassNames }}
      modal={{ classNames: popupClassNames }}
      drawer={{ classNames: popupClassNames }}
      locale={
        { en: enUS, "zh-CN": zhCN, "zh-TW": zhTW, ja: jaJP, ko: koKR }[locale]
      }
    >
      {children}
    </ConfigProvider>
  );
}

export function productTheme(appearance: UiAppearance): ThemeConfig {
  const dark = appearance === "dark";
  return {
    algorithm: dark ? AntdTheme.darkAlgorithm : AntdTheme.defaultAlgorithm,
    token: {
      colorPrimary: dark ? "#9474ff" : "#7955d9",
      colorText: dark ? "#edeef5" : "#252a38",
      colorTextSecondary: dark ? "#9295a7" : "#70778b",
      colorBgLayout: dark ? "#15161b" : "#eceef3",
      colorBgContainer: dark ? "#202128" : "#ffffff",
      colorBgElevated: dark ? "#272831" : "#ffffff",
      colorBorder: dark ? "#373842" : "#d7dbe5",
      colorBorderSecondary: dark ? "#30313b" : "#e6e8ef",
      borderRadius: 8,
      borderRadiusLG: 12,
      fontSize: 14,
      fontFamily: antdTheme.token?.fontFamily,
    },
    components: {
      Dropdown: {
        fontSize: 13,
        lineHeight: 20 / 13,
        paddingBlock: 8,
        paddingXXS: 8,
        borderRadiusSM: 8,
      },
      Menu: { fontSize: 13, itemHeight: 36 },
      Tooltip: { fontSize: 13 },
    },
  };
}

// Static notification/message/Modal.confirm calls render in their own React
// root and don't see <ConfigProvider>, but they do read the global config.
export function configureAntdStatics() {
  ConfigProvider.config({ theme: antdTheme });
}
