import { useSelector, GlobalActionsProvider } from '@plasmicapp/host';
import registerToken from '@plasmicapp/host/registerToken';
import { addLoadingStateListener } from '@plasmicapp/query';
import { ConfigProvider, App, theme, message, notification } from 'antd';
import React from 'react';
import ar_EG from 'antd/lib/locale/ar_EG.js';
import az_AZ from 'antd/lib/locale/az_AZ.js';
import bg_BG from 'antd/lib/locale/bg_BG.js';
import bn_BD from 'antd/lib/locale/bn_BD.js';
import by_BY from 'antd/lib/locale/by_BY.js';
import ca_ES from 'antd/lib/locale/ca_ES.js';
import cs_CZ from 'antd/lib/locale/cs_CZ.js';
import da_DK from 'antd/lib/locale/da_DK.js';
import de_DE from 'antd/lib/locale/de_DE.js';
import el_GR from 'antd/lib/locale/el_GR.js';
import en_GB from 'antd/lib/locale/en_GB.js';
import en_US from 'antd/lib/locale/en_US.js';
import es_ES from 'antd/lib/locale/es_ES.js';
import es_US from 'antd/lib/locale/es_US.js';
import et_EE from 'antd/lib/locale/et_EE.js';
import eu_ES from 'antd/lib/locale/eu_ES.js';
import fa_IR from 'antd/lib/locale/fa_IR.js';
import fi_FI from 'antd/lib/locale/fi_FI.js';
import fr_BE from 'antd/lib/locale/fr_BE.js';
import fr_CA from 'antd/lib/locale/fr_CA.js';
import fr_FR from 'antd/lib/locale/fr_FR.js';
import ga_IE from 'antd/lib/locale/ga_IE.js';
import gl_ES from 'antd/lib/locale/gl_ES.js';
import he_IL from 'antd/lib/locale/he_IL.js';
import hi_IN from 'antd/lib/locale/hi_IN.js';
import hr_HR from 'antd/lib/locale/hr_HR.js';
import hu_HU from 'antd/lib/locale/hu_HU.js';
import hy_AM from 'antd/lib/locale/hy_AM.js';
import id_ID from 'antd/lib/locale/id_ID.js';
import is_IS from 'antd/lib/locale/is_IS.js';
import it_IT from 'antd/lib/locale/it_IT.js';
import ja_JP from 'antd/lib/locale/ja_JP.js';
import ka_GE from 'antd/lib/locale/ka_GE.js';
import kk_KZ from 'antd/lib/locale/kk_KZ.js';
import km_KH from 'antd/lib/locale/km_KH.js';
import kmr_IQ from 'antd/lib/locale/kmr_IQ.js';
import kn_IN from 'antd/lib/locale/kn_IN.js';
import ko_KR from 'antd/lib/locale/ko_KR.js';
import ku_IQ from 'antd/lib/locale/ku_IQ.js';
import lt_LT from 'antd/lib/locale/lt_LT.js';
import lv_LV from 'antd/lib/locale/lv_LV.js';
import mk_MK from 'antd/lib/locale/mk_MK.js';
import ml_IN from 'antd/lib/locale/ml_IN.js';
import mn_MN from 'antd/lib/locale/mn_MN.js';
import mr_IN from 'antd/lib/locale/mr_IN.js';
import ms_MY from 'antd/lib/locale/ms_MY.js';
import my_MM from 'antd/lib/locale/my_MM.js';
import nb_NO from 'antd/lib/locale/nb_NO.js';
import ne_NP from 'antd/lib/locale/ne_NP.js';
import nl_BE from 'antd/lib/locale/nl_BE.js';
import nl_NL from 'antd/lib/locale/nl_NL.js';
import pl_PL from 'antd/lib/locale/pl_PL.js';
import pt_BR from 'antd/lib/locale/pt_BR.js';
import pt_PT from 'antd/lib/locale/pt_PT.js';
import ro_RO from 'antd/lib/locale/ro_RO.js';
import ru_RU from 'antd/lib/locale/ru_RU.js';
import si_LK from 'antd/lib/locale/si_LK.js';
import sk_SK from 'antd/lib/locale/sk_SK.js';
import sl_SI from 'antd/lib/locale/sl_SI.js';
import sq_AL from 'antd/lib/locale/sq_AL.js';
import sr_RS from 'antd/lib/locale/sr_RS.js';
import sv_SE from 'antd/lib/locale/sv_SE.js';
import ta_IN from 'antd/lib/locale/ta_IN.js';
import th_TH from 'antd/lib/locale/th_TH.js';
import tk_TK from 'antd/lib/locale/tk_TK.js';
import tr_TR from 'antd/lib/locale/tr_TR.js';
import uk_UA from 'antd/lib/locale/uk_UA.js';
import ur_PK from 'antd/lib/locale/ur_PK.js';
import uz_UZ from 'antd/lib/locale/uz_UZ.js';
import vi_VN from 'antd/lib/locale/vi_VN.js';
import zh_CN from 'antd/lib/locale/zh_CN.js';
import zh_HK from 'antd/lib/locale/zh_HK.js';
import zh_TW from 'antd/lib/locale/zh_TW.js';
import 'dayjs/locale/ar';
import 'dayjs/locale/az';
import 'dayjs/locale/be';
import 'dayjs/locale/bg';
import 'dayjs/locale/bn-bd';
import 'dayjs/locale/ca';
import 'dayjs/locale/cs';
import 'dayjs/locale/da';
import 'dayjs/locale/de';
import 'dayjs/locale/el';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/es';
import 'dayjs/locale/et';
import 'dayjs/locale/eu';
import 'dayjs/locale/fa';
import 'dayjs/locale/fi';
import 'dayjs/locale/fr';
import 'dayjs/locale/fr-ca';
import 'dayjs/locale/ga';
import 'dayjs/locale/gl';
import 'dayjs/locale/he';
import 'dayjs/locale/hi';
import 'dayjs/locale/hr';
import 'dayjs/locale/hu';
import 'dayjs/locale/hy-am';
import 'dayjs/locale/id';
import 'dayjs/locale/is';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ka';
import 'dayjs/locale/kk';
import 'dayjs/locale/km';
import 'dayjs/locale/kn';
import 'dayjs/locale/ko';
import 'dayjs/locale/ku';
import 'dayjs/locale/lt';
import 'dayjs/locale/lv';
import 'dayjs/locale/mk';
import 'dayjs/locale/ml';
import 'dayjs/locale/mn';
import 'dayjs/locale/mr';
import 'dayjs/locale/ms';
import 'dayjs/locale/my';
import 'dayjs/locale/nb';
import 'dayjs/locale/nl';
import 'dayjs/locale/nl-be';
import 'dayjs/locale/pl';
import 'dayjs/locale/pt';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ro';
import 'dayjs/locale/ru';
import 'dayjs/locale/si';
import 'dayjs/locale/sk';
import 'dayjs/locale/sl';
import 'dayjs/locale/sq';
import 'dayjs/locale/sr';
import 'dayjs/locale/sv';
import 'dayjs/locale/ta';
import 'dayjs/locale/th';
import 'dayjs/locale/tk';
import 'dayjs/locale/tr';
import 'dayjs/locale/uk';
import 'dayjs/locale/ur';
import 'dayjs/locale/uz';
import 'dayjs/locale/vi';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import { u as useIsMounted } from './react-utils-BpvCcwyE.esm.js';
import { m as makeRegisterGlobalContext } from './utils-Cmdig6Yl.esm.js';
import 'classnames';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const localePacks = {
  ar_EG,
  az_AZ,
  bg_BG,
  bn_BD,
  by_BY,
  ca_ES,
  cs_CZ,
  da_DK,
  de_DE,
  el_GR,
  en_GB,
  en_US,
  es_ES,
  es_US,
  et_EE,
  eu_ES,
  fa_IR,
  fi_FI,
  fr_BE,
  fr_CA,
  fr_FR,
  ga_IE,
  gl_ES,
  he_IL,
  hi_IN,
  hr_HR,
  hu_HU,
  hy_AM,
  id_ID,
  is_IS,
  it_IT,
  ja_JP,
  ka_GE,
  kk_KZ,
  km_KH,
  kmr_IQ,
  kn_IN,
  ko_KR,
  ku_IQ,
  lt_LT,
  lv_LV,
  mk_MK,
  ml_IN,
  mn_MN,
  mr_IN,
  ms_MY,
  my_MM,
  nb_NO,
  ne_NP,
  nl_BE,
  nl_NL,
  pl_PL,
  pt_BR,
  pt_PT,
  ro_RO,
  ru_RU,
  si_LK,
  sk_SK,
  sl_SI,
  sq_AL,
  sr_RS,
  sv_SE,
  ta_IN,
  th_TH,
  tk_TK,
  tr_TR,
  uk_UA,
  ur_PK,
  uz_UZ,
  vi_VN,
  zh_CN,
  zh_HK,
  zh_TW
};
function normalizeLocale(locale) {
  return "default" in locale ? locale.default : locale;
}
const antdLocales = Object.fromEntries(
  Object.entries(localePacks).map(([key, locale]) => [key, normalizeLocale(locale)])
);

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
    defaultDark = false
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
          wireframe
        }).filter(([_key, val]) => !!val)
      )
    }
  };
}
function AntdConfigProvider(props) {
  const { children, locale, themeStyles, loadingText, removeLoading, ...rest } = props;
  return /* @__PURE__ */ React.createElement(
    ConfigProvider,
    {
      locale: typeof locale === "string" ? antdLocales[locale] : locale ?? antdLocales.en_US,
      ...themeToAntdConfig({
        ...rest,
        fontFamily: themeStyles.fontFamily,
        fontSize: themeStyles.fontSize ? parseInt(themeStyles.fontSize) : void 0,
        lineHeight: themeStyles.lineHeight ? parseInt(themeStyles.lineHeight) : void 0,
        colorTextBase: themeStyles.color
      })
    },
    /* @__PURE__ */ React.createElement(App, { style: { display: "contents" } }, /* @__PURE__ */ React.createElement(ForkedApp, null, /* @__PURE__ */ React.createElement(
      InnerConfigProvider,
      {
        loadingText,
        removeLoading
      },
      children
    )))
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
  ${Object.entries(token).map(([key, val]) => `${makeVarName(key)}:${normTokenValue(val)};`).join("\n")}
}
  `,
    [token]
  );
  const app = useAppContext();
  const actions = React.useMemo(
    () => ({
      showMessage: (type, content2, duration) => {
        app.message.open({ type, content: content2, duration });
      },
      showNotification: (type, message, description, duration, placement) => {
        app.notification[type ?? "info"]({
          title: message?.toString(),
          description: description?.toString(),
          duration,
          placement
        });
      },
      hideNotifications: () => {
        app.notification.destroy();
      }
    }),
    [app]
  );
  const enableLoadingBoundary = !!useSelector(
    "plasmicInternalEnableLoadingBoundary"
  );
  if (!GlobalActionsProvider) {
    warnOutdatedDeps();
  }
  let content = GlobalActionsProvider ? /* @__PURE__ */ React.createElement(
    GlobalActionsProvider,
    {
      contextName: "plasmic-antd6-config-provider",
      actions
    },
    children
  ) : children;
  if (!removeLoading && enableLoadingBoundary) {
    content = /* @__PURE__ */ React.createElement(React.Suspense, null, content);
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", { dangerouslySetInnerHTML: { __html: cssStyles } }), content, !removeLoading && /* @__PURE__ */ React.createElement(GlobalLoadingIndicator, { loadingText }));
}
let warned = false;
function warnOutdatedDeps() {
  if (!warned) {
    console.warn(
      `You are using a version of @plasmicapp/* that is too old. Please upgrade to the latest version.`
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
        key: `plasmic-antd6-global-loading-indicator`
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
        { immediate: false }
      );
    } else {
      warnOutdatedDeps();
      return () => {
      };
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
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const appContext = React.useMemo(
    () => ({
      message: messageApi,
      notification: notificationApi
    }),
    [messageApi, notificationApi]
  );
  return /* @__PURE__ */ React.createElement(ForkedAppContext.Provider, { value: appContext }, messageContextHolder, notificationContextHolder, props.children);
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
    const displayName = Array.isArray(name) ? name[1] : makeNiceName(withoutPrefix(name, removePrefix));
    return {
      name: `antd6-${tokenName}`,
      displayName: `System: ${displayName}`,
      value: `var(--antd6-${tokenName})`,
      type
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
    "colorLinkHover"
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
  colorTokens.forEach(
    (name) => regs.push(makeGenericToken(name, "color", "color"))
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
    "marginXXL"
    // "controlPaddingHorizontal",
    // "controlPaddingHorizontalSM",
  ];
  spacingTokens.forEach(
    (token) => regs.push(makeGenericToken(token, "spacing"))
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
    "fontSizeHeading5"
  ];
  fontSizeTokens.forEach(
    (token) => regs.push(makeGenericToken(token, "font-size", "fontSize"))
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
    "lineHeightHeading5"
  ];
  lineHeightTokens.forEach(
    (token) => regs.push(makeGenericToken(token, "line-height", "lineHeight"))
  );
  if (loader) {
    regs.forEach((t) => loader.registerToken(t));
  } else {
    regs.forEach((t) => registerToken(t));
  }
}
const registerConfigProvider = makeRegisterGlobalContext(
  AntdConfigProvider,
  {
    name: "plasmic-antd6-config-provider",
    displayName: "Ant Design System Settings",
    description: "Project-wide Ant Design theme and feedback context, managed in System Settings. It wraps pages automatically; do not insert it into a page or component tree. Use its qualified showMessage/showNotification global actions without adding a wrapper.",
    props: {
      locale: {
        type: "choice",
        options: Object.keys(antdLocales),
        defaultValueHint: "en_US",
        description: "Language for built-in component text. Custom business text is unchanged."
      },
      colorPrimary: {
        type: "color",
        defaultValue: "#1677ff",
        disableTokens: true
      },
      colorSuccess: {
        type: "color",
        defaultValue: "#52c41a",
        disableTokens: true
      },
      colorWarning: {
        type: "color",
        defaultValue: "#faad14",
        disableTokens: true
      },
      colorError: {
        type: "color",
        defaultValue: "#ff4d4f",
        disableTokens: true
      },
      colorInfo: {
        type: "color",
        defaultValue: "#1677ff",
        disableTokens: true
      },
      colorBgBase: {
        type: "color",
        defaultValue: "#ffffff",
        disableTokens: true
      },
      lineWidth: {
        type: "number",
        defaultValue: 1
      },
      borderRadius: {
        type: "number",
        defaultValue: 6
      },
      controlHeight: {
        type: "number",
        defaultValue: 32
      },
      sizeUnit: {
        type: "number",
        defaultValue: 4
      },
      sizeStep: {
        type: "number",
        defaultValue: 4
      },
      loadingText: {
        type: "string",
        defaultValueHint: "Loading..."
      },
      removeLoading: {
        type: "boolean",
        defaultValueHint: false
      },
      wireframe: {
        type: "boolean",
        defaultValue: false
      },
      defaultDark: {
        type: "boolean",
        defaultValue: false
      },
      themeStyles: {
        type: "themeStyles"
      }
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
                defaultValue: "success"
              }
            },
            { name: "content", type: "string" },
            { name: "duration", type: { type: "number", defaultValueHint: 3 } }
          ]
        },
        showNotification: {
          displayName: "Show notification",
          parameters: [
            {
              name: "type",
              type: {
                type: "choice",
                options: ["success", "error", "info", "warning"],
                defaultValue: "info"
              }
            },
            {
              name: "message",
              type: {
                type: "string",
                defaultValue: "A message for you!"
              }
            },
            {
              name: "description",
              type: {
                type: "string",
                defaultValue: "Would you like to learn more?"
              }
            },
            {
              name: "duration",
              type: {
                type: "number",
                defaultValueHint: 5
              }
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
                  "bottomRight"
                ],
                defaultValueHint: "topRight"
              }
            }
          ]
        },
        hideNotifications: {
          displayName: "Hide notifications",
          parameters: []
        }
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerConfigProvider",
    importName: "AntdConfigProvider"
  }
);

export { AntdConfigProvider, registerConfigProvider, registerTokens, themeToAntdConfig };
//# sourceMappingURL=registerConfigProvider.esm.js.map
