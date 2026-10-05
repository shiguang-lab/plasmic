import { GlobalActionsProvider, useSelector } from "@plasmicapp/host";
import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import registerToken from "@plasmicapp/host/registerToken";
import { addLoadingStateListener } from "@plasmicapp/query";
import { App, ConfigProvider, message, notification, theme } from "antd";
import enUS from "antd/lib/locale/en_US.js";
import "classnames";
import React from "react";
import { u as useIsMounted } from "./react-utils-BpvCcwyE.esm.js";
import { m as makeRegisterGlobalContext } from "./utils-CSvRw6Za.esm.js";

let defaultLocale = enUS;
if ("default" in enUS) {
  defaultLocale = enUS.default;
}
function themeToAntdConfig(opts) {
  const {
    colorTextBase,
    colorPrimary,
    colorSuccess,
    colorWarning,
    colorError,
    colorInfo,
    colorBgBase,
    fontFamily,
    fontSize,
    lineWidth,
    borderRadius,
    controlHeight,
    sizeUnit,
    sizeStep,
    wireframe,
    defaultDark = false,
  } = opts;
  return {
    theme: {
      algorithm: defaultDark ? theme.darkAlgorithm : void 0,
      token: Object.fromEntries(
        Object.entries({
          colorTextBase,
          colorPrimary,
          colorSuccess,
          colorWarning,
          colorError,
          colorInfo,
          colorBgBase,
          fontFamily,
          fontSize,
          lineWidth,
          borderRadius,
          controlHeight,
          sizeUnit,
          sizeStep,
          wireframe,
        }).filter(([_key, val]) => !!val),
      ),
    },
  };
}
function AntdConfigProvider(props) {
  const { children, locale, themeStyles, loadingText, removeLoading, ...rest } =
    props;
  return /* @__PURE__ */ React.createElement(
    ConfigProvider,
    {
      locale: locale ?? defaultLocale,
      ...themeToAntdConfig({
        ...rest,
        fontFamily: themeStyles.fontFamily,
        fontSize: themeStyles.fontSize
          ? parseInt(themeStyles.fontSize)
          : void 0,
        lineHeight: themeStyles.lineHeight
          ? parseInt(themeStyles.lineHeight)
          : void 0,
        colorTextBase: themeStyles.color,
      }),
    },
    /* @__PURE__ */ React.createElement(
      App,
      null,
      /* @__PURE__ */ React.createElement(
        ForkedApp,
        null,
        /* @__PURE__ */ React.createElement(
          InnerConfigProvider,
          {
            loadingText,
            removeLoading,
          },
          children,
        ),
      ),
    ),
  );
}
function normTokenValue(val) {
  if (typeof val === "string") {
    return val.trim();
  } else if (typeof val === "number") {
    return `${val}px`;
  } else {
    return val;
  }
}
function InnerConfigProvider(props) {
  const { children, loadingText, removeLoading } = props;
  const { token } = theme.useToken();
  const makeVarName = (name) => `--antd6-${name}`;
  const cssStyles = React.useMemo(
    () => `
:root {
  ${Object.entries(token)
    .map(([key, val]) => `${makeVarName(key)}:${normTokenValue(val)};`)
    .join("\n")}
}
  `,
    [token],
  );
  const app = useAppContext();
  const actions = React.useMemo(
    () => ({
      showMessage: (type, content2, duration) => {
        app.message.open({ type, content: content2, duration });
      },
      showNotification: (type, message2, description, duration, placement) => {
        app.notification[type ?? "info"]({
          title: message2?.toString(),
          description: description?.toString(),
          duration,
          placement,
        });
      },
      hideNotifications: () => {
        app.notification.destroy();
      },
    }),
    [app],
  );
  const enableLoadingBoundary = !!useSelector(
    "plasmicInternalEnableLoadingBoundary",
  );
  if (!GlobalActionsProvider) {
    warnOutdatedDeps();
  }
  let content = GlobalActionsProvider
    ? /* @__PURE__ */ React.createElement(
        GlobalActionsProvider,
        {
          contextName: "plasmic-antd6-config-provider",
          actions,
        },
        children,
      )
    : children;
  if (!removeLoading && enableLoadingBoundary) {
    content = /* @__PURE__ */ React.createElement(
      React.Suspense,
      null,
      content,
    );
  }
  return /* @__PURE__ */ React.createElement(
    React.Fragment,
    null,
    /* @__PURE__ */ React.createElement("style", {
      dangerouslySetInnerHTML: { __html: cssStyles },
    }),
    content,
    !removeLoading &&
      /* @__PURE__ */ React.createElement(GlobalLoadingIndicator, {
        loadingText,
      }),
  );
}
let warned = false;
function warnOutdatedDeps() {
  if (!warned) {
    console.warn(
      `You are using a version of @plasmicapp/* that is too old. Please upgrade to the latest version.`,
    );
    warned = true;
  }
}
function GlobalLoadingIndicator(props) {
  const { loadingText } = props;
  const app = useAppContext();
  const isLoadingRef = React.useRef(false);
  const isMounted = useIsMounted();
  const showLoading = React.useCallback(() => {
    if (isMounted() && isLoadingRef.current) {
      app.message.open({
        content: loadingText ?? "Loading...",
        duration: 0,
        key: `plasmic-antd6-global-loading-indicator`,
      });
    }
  }, [app, loadingText, isMounted, isLoadingRef]);
  const hideLoading = React.useCallback(() => {
    setTimeout(() => {
      if (isMounted() && !isLoadingRef.current) {
        app.message.destroy(`plasmic-antd6-global-loading-indicator`);
      }
    }, 500);
  }, [app, isMounted, isLoadingRef]);
  React.useEffect(() => {
    if (addLoadingStateListener) {
      if (isLoadingRef.current) {
        showLoading();
      } else {
        hideLoading();
      }
      return addLoadingStateListener(
        (isLoading) => {
          isLoadingRef.current = isLoading;
          if (isMounted()) {
            if (isLoading) {
              showLoading();
            } else {
              hideLoading();
            }
          }
        },
        // Disabled immediat because it's creating an infinite rendering
        // https://app.shortcut.com/plasmic/story/36991
        { immediate: false },
      );
    } else {
      warnOutdatedDeps();
      return () => {};
    }
  }, [app, isMounted, isLoadingRef, showLoading, hideLoading]);
  return null;
}
const ForkedAppContext = React.createContext(void 0);
function useAppContext() {
  const context = React.useContext(ForkedAppContext);
  if (!context) {
    throw new Error("Must call useAppContext from under ForkedApp");
  }
  return context;
}
function ForkedApp(props) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const appContext = React.useMemo(
    () => ({
      message: messageApi,
      notification: notificationApi,
    }),
    [messageApi, notificationApi],
  );
  return /* @__PURE__ */ React.createElement(
    ForkedAppContext.Provider,
    { value: appContext },
    messageContextHolder,
    notificationContextHolder,
    props.children,
  );
}
function registerTokens(loader) {
  const regs = [];
  const withoutPrefix = (name, prefix) => {
    if (!prefix) {
      return name;
    }
    const index = name.indexOf(prefix);
    return index === 0 ? name.substring(prefix.length) : name;
  };
  function makeNiceName(name) {
    name = name[0].toUpperCase() + name.substring(1);
    return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  const makeGenericToken = (name, type, removePrefix) => {
    const tokenName = Array.isArray(name) ? name[0] : name;
    const displayName = Array.isArray(name)
      ? name[1]
      : makeNiceName(withoutPrefix(name, removePrefix));
    return {
      name: `antd6-${tokenName}`,
      displayName: `System: ${displayName}`,
      value: `var(--antd6-${tokenName})`,
      type,
    };
  };
  const colorTokens = [
    // Seed tokens
    "colorPrimary",
    "colorSuccess",
    "colorWarning",
    "colorError",
    "colorInfo",
    // Map tokens
    //   - neutral
    "colorText",
    "colorTextSecondary",
    "colorTextTertiary",
    "colorTextQuaternary",
    "colorBorder",
    "colorBorderSecondary",
    "colorFill",
    "colorFillSecondary",
    "colorFillTertiary",
    "colorFillQuaternary",
    "colorBgLayout",
    "colorBgContainer",
    "colorBgElevated",
    "colorBgSpotlight",
    //    - primary
    "colorPrimaryBg",
    "colorPrimaryBgHover",
    "colorPrimaryBorder",
    "colorPrimaryBorderHover",
    "colorPrimaryHover",
    "colorPrimaryActive",
    "colorPrimaryTextHover",
    "colorPrimaryText",
    "colorPrimaryTextActive",
    //    - success
    "colorSuccessBg",
    "colorSuccessBgHover",
    "colorSuccessBorder",
    "colorSuccessBorderHover",
    "colorSuccessHover",
    "colorSuccessActive",
    "colorSuccessTextHover",
    "colorSuccessText",
    "colorSuccessTextActive",
    //    - warning
    "colorWarningBg",
    "colorWarningBgHover",
    "colorWarningBorder",
    "colorWarningBorderHover",
    "colorWarningHover",
    "colorWarningActive",
    "colorWarningTextHover",
    "colorWarningText",
    "colorWarningTextActive",
    //    - info
    "colorInfoBg",
    "colorInfoBgHover",
    "colorInfoBorder",
    "colorInfoBorderHover",
    "colorInfoHover",
    "colorInfoActive",
    "colorInfoTextHover",
    "colorInfoText",
    "colorInfoTextActive",
    //    - error
    "colorErrorBg",
    "colorErrorBgHover",
    "colorErrorBorder",
    "colorErrorBorderHover",
    "colorErrorHover",
    "colorErrorActive",
    "colorErrorTextHover",
    "colorErrorText",
    "colorErrorTextActive",
    //    - other
    "colorWhite",
    "colorBgMask",
    // Alias tokens
    // "colorFillContentHover",
    // "colorFillAlter",
    // "colorFillContent",
    // "colorBgContainerDisabled",
    // "colorBgTextHover",
    // "colorBgTextActive",
    // "colorBorderBg",
    // "colorSplit",
    // "colorTextPlaceholder",
    // "colorTextDisabled",
    // "colorTextHeading",
    // "colorTextLabel",
    // "colorTextDescription",
    // "colorTextLightSolid",
    "colorIcon",
    "colorIconHover",
    "colorLink",
    "colorLinkHover",
    // "colorLinkActive",
    // "colorLinkHighlight",
    // "controlOutline",
    // "controlWarningOutline",
    // "controlErrorOutline",
    // "controlItemBgHover",
    // "controlItemBgActive",
    // "controlItemBgActiveHover",
    // "controlItemBgActiveDisabled",
  ];
  colorTokens.forEach((name) =>
    regs.push(makeGenericToken(name, "color", "color")),
  );
  const spacingTokens = [
    // Seed
    // "lineWidth",
    // "borderRadius",
    // "controlHeight",
    // Map tokens
    // "sizeXXL",
    // "sizeXL",
    // "sizeLG",
    // "sizeMD",
    // "sizeMS",
    // "size",
    // "sizeSM",
    // "sizeXS",
    // "sizeXXS",
    // "controlHeightXS",
    // "controlHeightSM",
    // "controlHeightLG",
    // "lineWidthBold",
    // "borderRadiusXS",
    // "borderRadiusSM",
    // "borderRadiusLG",
    // "borderRadiusOuter",
    // Alias tokens
    // "controlOutlineWidth",
    // "controlInteractiveSize",
    "paddingXXS",
    "paddingXS",
    "paddingSM",
    ["padding", "Padding M"],
    "paddingMD",
    "paddingLG",
    "paddingXL",
    // "paddingContentHorizontalLG",
    // "paddingContentHorizontal",
    // "paddingContentHorizontalSM",
    // "paddingContentVerticalLG",
    // "paddingContentVertical",
    // "paddingContentVerticalSM",
    "marginXXS",
    "marginXS",
    "marginSM",
    ["margin", "Margin M"],
    "marginMD",
    "marginLG",
    "marginXL",
    "marginXXL",
    // "controlPaddingHorizontal",
    // "controlPaddingHorizontalSM",
  ];
  spacingTokens.forEach((token) =>
    regs.push(makeGenericToken(token, "spacing")),
  );
  const fontSizeTokens = [
    // Seed token
    ["fontSize", "M"],
    // Map tokens
    "fontSizeSM",
    "fontSizeLG",
    "fontSizeXL",
    "fontSizeHeading1",
    "fontSizeHeading2",
    "fontSizeHeading3",
    "fontSizeHeading4",
    "fontSizeHeading5",
  ];
  fontSizeTokens.forEach((token) =>
    regs.push(makeGenericToken(token, "font-size", "fontSize")),
  );
  const lineHeightTokens = [
    // Map tokens
    ["lineHeight", "M"],
    "lineHeightLG",
    "lineHeightSM",
    "lineHeightHeading1",
    "lineHeightHeading2",
    "lineHeightHeading3",
    "lineHeightHeading4",
    "lineHeightHeading5",
  ];
  lineHeightTokens.forEach((token) =>
    regs.push(makeGenericToken(token, "line-height", "lineHeight")),
  );
  if (loader) {
    regs.forEach((t) => loader.registerToken(t));
  } else {
    regs.forEach((t) => registerToken(t));
  }
}
const registerConfigProvider = makeRegisterGlobalContext(AntdConfigProvider, {
  name: "plasmic-antd6-config-provider",
  displayName: "Ant Design System Settings",
  props: {
    colorPrimary: {
      type: "color",
      defaultValue: "#1677ff",
      disableTokens: true,
    },
    colorSuccess: {
      type: "color",
      defaultValue: "#52c41a",
      disableTokens: true,
    },
    colorWarning: {
      type: "color",
      defaultValue: "#faad14",
      disableTokens: true,
    },
    colorError: {
      type: "color",
      defaultValue: "#ff4d4f",
      disableTokens: true,
    },
    colorInfo: {
      type: "color",
      defaultValue: "#1677ff",
      disableTokens: true,
    },
    colorBgBase: {
      type: "color",
      defaultValue: "#ffffff",
      disableTokens: true,
    },
    lineWidth: {
      type: "number",
      defaultValue: 1,
    },
    borderRadius: {
      type: "number",
      defaultValue: 6,
    },
    controlHeight: {
      type: "number",
      defaultValue: 32,
    },
    sizeUnit: {
      type: "number",
      defaultValue: 4,
    },
    sizeStep: {
      type: "number",
      defaultValue: 4,
    },
    loadingText: {
      type: "string",
      defaultValueHint: "Loading...",
    },
    removeLoading: {
      type: "boolean",
      defaultValueHint: false,
    },
    wireframe: {
      type: "boolean",
      defaultValue: false,
    },
    defaultDark: {
      type: "boolean",
      defaultValue: false,
    },
    themeStyles: {
      type: "themeStyles",
    },
  },
  ...{
    globalActions: {
      showMessage: {
        displayName: "Show message",
        parameters: [
          {
            name: "type",
            type: {
              type: "choice",
              options: ["success", "error", "info", "warning"],
              defaultValue: "success",
            },
          },
          { name: "content", type: "string" },
          { name: "duration", type: { type: "number", defaultValueHint: 3 } },
        ],
      },
      showNotification: {
        displayName: "Show notification",
        parameters: [
          {
            name: "type",
            type: {
              type: "choice",
              options: ["success", "error", "info", "warning"],
              defaultValue: "info",
            },
          },
          {
            name: "message",
            type: {
              type: "string",
              defaultValue: "A message for you!",
            },
          },
          {
            name: "description",
            type: {
              type: "string",
              defaultValue: "Would you like to learn more?",
            },
          },
          {
            name: "duration",
            type: {
              type: "number",
              defaultValueHint: 5,
            },
          },
          {
            name: "placement",
            type: {
              type: "choice",
              options: [
                "top",
                "topLeft",
                "topRight",
                "bottom",
                "bottomLeft",
                "bottomRight",
              ],
              defaultValueHint: "topRight",
            },
          },
        ],
      },
      hideNotifications: {
        displayName: "Hide notifications",
        parameters: [],
      },
    },
  },
  importPath: "@shiguang-lab/plasmic-antd6/skinny/registerConfigProvider",
  importName: "AntdConfigProvider",
});

export {
  AntdConfigProvider,
  registerConfigProvider,
  registerTokens,
  themeToAntdConfig,
};
//# sourceMappingURL=registerConfigProvider.esm.js.map
