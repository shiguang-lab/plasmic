'use strict';

var host = require('@plasmicapp/host');
var registerToken = require('@plasmicapp/host/registerToken');
var query = require('@plasmicapp/query');
var Ant = require('antd');
var React = require('react');
var ar_EG = require('antd/lib/locale/ar_EG.js');
var az_AZ = require('antd/lib/locale/az_AZ.js');
var bg_BG = require('antd/lib/locale/bg_BG.js');
var bn_BD = require('antd/lib/locale/bn_BD.js');
var by_BY = require('antd/lib/locale/by_BY.js');
var ca_ES = require('antd/lib/locale/ca_ES.js');
var cs_CZ = require('antd/lib/locale/cs_CZ.js');
var da_DK = require('antd/lib/locale/da_DK.js');
var de_DE = require('antd/lib/locale/de_DE.js');
var el_GR = require('antd/lib/locale/el_GR.js');
var en_GB = require('antd/lib/locale/en_GB.js');
var en_US = require('antd/lib/locale/en_US.js');
var es_ES = require('antd/lib/locale/es_ES.js');
var es_US = require('antd/lib/locale/es_US.js');
var et_EE = require('antd/lib/locale/et_EE.js');
var eu_ES = require('antd/lib/locale/eu_ES.js');
var fa_IR = require('antd/lib/locale/fa_IR.js');
var fi_FI = require('antd/lib/locale/fi_FI.js');
var fr_BE = require('antd/lib/locale/fr_BE.js');
var fr_CA = require('antd/lib/locale/fr_CA.js');
var fr_FR = require('antd/lib/locale/fr_FR.js');
var ga_IE = require('antd/lib/locale/ga_IE.js');
var gl_ES = require('antd/lib/locale/gl_ES.js');
var he_IL = require('antd/lib/locale/he_IL.js');
var hi_IN = require('antd/lib/locale/hi_IN.js');
var hr_HR = require('antd/lib/locale/hr_HR.js');
var hu_HU = require('antd/lib/locale/hu_HU.js');
var hy_AM = require('antd/lib/locale/hy_AM.js');
var id_ID = require('antd/lib/locale/id_ID.js');
var is_IS = require('antd/lib/locale/is_IS.js');
var it_IT = require('antd/lib/locale/it_IT.js');
var ja_JP = require('antd/lib/locale/ja_JP.js');
var ka_GE = require('antd/lib/locale/ka_GE.js');
var kk_KZ = require('antd/lib/locale/kk_KZ.js');
var km_KH = require('antd/lib/locale/km_KH.js');
var kmr_IQ = require('antd/lib/locale/kmr_IQ.js');
var kn_IN = require('antd/lib/locale/kn_IN.js');
var ko_KR = require('antd/lib/locale/ko_KR.js');
var ku_IQ = require('antd/lib/locale/ku_IQ.js');
var lt_LT = require('antd/lib/locale/lt_LT.js');
var lv_LV = require('antd/lib/locale/lv_LV.js');
var mk_MK = require('antd/lib/locale/mk_MK.js');
var ml_IN = require('antd/lib/locale/ml_IN.js');
var mn_MN = require('antd/lib/locale/mn_MN.js');
var mr_IN = require('antd/lib/locale/mr_IN.js');
var ms_MY = require('antd/lib/locale/ms_MY.js');
var my_MM = require('antd/lib/locale/my_MM.js');
var nb_NO = require('antd/lib/locale/nb_NO.js');
var ne_NP = require('antd/lib/locale/ne_NP.js');
var nl_BE = require('antd/lib/locale/nl_BE.js');
var nl_NL = require('antd/lib/locale/nl_NL.js');
var pl_PL = require('antd/lib/locale/pl_PL.js');
var pt_BR = require('antd/lib/locale/pt_BR.js');
var pt_PT = require('antd/lib/locale/pt_PT.js');
var ro_RO = require('antd/lib/locale/ro_RO.js');
var ru_RU = require('antd/lib/locale/ru_RU.js');
var si_LK = require('antd/lib/locale/si_LK.js');
var sk_SK = require('antd/lib/locale/sk_SK.js');
var sl_SI = require('antd/lib/locale/sl_SI.js');
var sq_AL = require('antd/lib/locale/sq_AL.js');
var sr_RS = require('antd/lib/locale/sr_RS.js');
var sv_SE = require('antd/lib/locale/sv_SE.js');
var ta_IN = require('antd/lib/locale/ta_IN.js');
var th_TH = require('antd/lib/locale/th_TH.js');
var tk_TK = require('antd/lib/locale/tk_TK.js');
var tr_TR = require('antd/lib/locale/tr_TR.js');
var uk_UA = require('antd/lib/locale/uk_UA.js');
var ur_PK = require('antd/lib/locale/ur_PK.js');
var uz_UZ = require('antd/lib/locale/uz_UZ.js');
var vi_VN = require('antd/lib/locale/vi_VN.js');
var zh_CN = require('antd/lib/locale/zh_CN.js');
var zh_HK = require('antd/lib/locale/zh_HK.js');
var zh_TW = require('antd/lib/locale/zh_TW.js');
require('dayjs/locale/ar');
require('dayjs/locale/az');
require('dayjs/locale/be');
require('dayjs/locale/bg');
require('dayjs/locale/bn-bd');
require('dayjs/locale/ca');
require('dayjs/locale/cs');
require('dayjs/locale/da');
require('dayjs/locale/de');
require('dayjs/locale/el');
require('dayjs/locale/en-gb');
require('dayjs/locale/es');
require('dayjs/locale/et');
require('dayjs/locale/eu');
require('dayjs/locale/fa');
require('dayjs/locale/fi');
require('dayjs/locale/fr');
require('dayjs/locale/fr-ca');
require('dayjs/locale/ga');
require('dayjs/locale/gl');
require('dayjs/locale/he');
require('dayjs/locale/hi');
require('dayjs/locale/hr');
require('dayjs/locale/hu');
require('dayjs/locale/hy-am');
require('dayjs/locale/id');
require('dayjs/locale/is');
require('dayjs/locale/it');
require('dayjs/locale/ja');
require('dayjs/locale/ka');
require('dayjs/locale/kk');
require('dayjs/locale/km');
require('dayjs/locale/kn');
require('dayjs/locale/ko');
require('dayjs/locale/ku');
require('dayjs/locale/lt');
require('dayjs/locale/lv');
require('dayjs/locale/mk');
require('dayjs/locale/ml');
require('dayjs/locale/mn');
require('dayjs/locale/mr');
require('dayjs/locale/ms');
require('dayjs/locale/my');
require('dayjs/locale/nb');
require('dayjs/locale/nl');
require('dayjs/locale/nl-be');
require('dayjs/locale/pl');
require('dayjs/locale/pt');
require('dayjs/locale/pt-br');
require('dayjs/locale/ro');
require('dayjs/locale/ru');
require('dayjs/locale/si');
require('dayjs/locale/sk');
require('dayjs/locale/sl');
require('dayjs/locale/sq');
require('dayjs/locale/sr');
require('dayjs/locale/sv');
require('dayjs/locale/ta');
require('dayjs/locale/th');
require('dayjs/locale/tk');
require('dayjs/locale/tr');
require('dayjs/locale/uk');
require('dayjs/locale/ur');
require('dayjs/locale/uz');
require('dayjs/locale/vi');
require('dayjs/locale/zh-cn');
require('dayjs/locale/zh-tw');
var reactUtils = require('./react-utils-CP3JYj1p.cjs.js');
var utils = require('./utils-Diqr9Iet.cjs.js');
require('classnames');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var registerToken__default = /*#__PURE__*/_interopDefault(registerToken);
var React__default = /*#__PURE__*/_interopDefault(React);
var ar_EG__default = /*#__PURE__*/_interopDefault(ar_EG);
var az_AZ__default = /*#__PURE__*/_interopDefault(az_AZ);
var bg_BG__default = /*#__PURE__*/_interopDefault(bg_BG);
var bn_BD__default = /*#__PURE__*/_interopDefault(bn_BD);
var by_BY__default = /*#__PURE__*/_interopDefault(by_BY);
var ca_ES__default = /*#__PURE__*/_interopDefault(ca_ES);
var cs_CZ__default = /*#__PURE__*/_interopDefault(cs_CZ);
var da_DK__default = /*#__PURE__*/_interopDefault(da_DK);
var de_DE__default = /*#__PURE__*/_interopDefault(de_DE);
var el_GR__default = /*#__PURE__*/_interopDefault(el_GR);
var en_GB__default = /*#__PURE__*/_interopDefault(en_GB);
var en_US__default = /*#__PURE__*/_interopDefault(en_US);
var es_ES__default = /*#__PURE__*/_interopDefault(es_ES);
var es_US__default = /*#__PURE__*/_interopDefault(es_US);
var et_EE__default = /*#__PURE__*/_interopDefault(et_EE);
var eu_ES__default = /*#__PURE__*/_interopDefault(eu_ES);
var fa_IR__default = /*#__PURE__*/_interopDefault(fa_IR);
var fi_FI__default = /*#__PURE__*/_interopDefault(fi_FI);
var fr_BE__default = /*#__PURE__*/_interopDefault(fr_BE);
var fr_CA__default = /*#__PURE__*/_interopDefault(fr_CA);
var fr_FR__default = /*#__PURE__*/_interopDefault(fr_FR);
var ga_IE__default = /*#__PURE__*/_interopDefault(ga_IE);
var gl_ES__default = /*#__PURE__*/_interopDefault(gl_ES);
var he_IL__default = /*#__PURE__*/_interopDefault(he_IL);
var hi_IN__default = /*#__PURE__*/_interopDefault(hi_IN);
var hr_HR__default = /*#__PURE__*/_interopDefault(hr_HR);
var hu_HU__default = /*#__PURE__*/_interopDefault(hu_HU);
var hy_AM__default = /*#__PURE__*/_interopDefault(hy_AM);
var id_ID__default = /*#__PURE__*/_interopDefault(id_ID);
var is_IS__default = /*#__PURE__*/_interopDefault(is_IS);
var it_IT__default = /*#__PURE__*/_interopDefault(it_IT);
var ja_JP__default = /*#__PURE__*/_interopDefault(ja_JP);
var ka_GE__default = /*#__PURE__*/_interopDefault(ka_GE);
var kk_KZ__default = /*#__PURE__*/_interopDefault(kk_KZ);
var km_KH__default = /*#__PURE__*/_interopDefault(km_KH);
var kmr_IQ__default = /*#__PURE__*/_interopDefault(kmr_IQ);
var kn_IN__default = /*#__PURE__*/_interopDefault(kn_IN);
var ko_KR__default = /*#__PURE__*/_interopDefault(ko_KR);
var ku_IQ__default = /*#__PURE__*/_interopDefault(ku_IQ);
var lt_LT__default = /*#__PURE__*/_interopDefault(lt_LT);
var lv_LV__default = /*#__PURE__*/_interopDefault(lv_LV);
var mk_MK__default = /*#__PURE__*/_interopDefault(mk_MK);
var ml_IN__default = /*#__PURE__*/_interopDefault(ml_IN);
var mn_MN__default = /*#__PURE__*/_interopDefault(mn_MN);
var mr_IN__default = /*#__PURE__*/_interopDefault(mr_IN);
var ms_MY__default = /*#__PURE__*/_interopDefault(ms_MY);
var my_MM__default = /*#__PURE__*/_interopDefault(my_MM);
var nb_NO__default = /*#__PURE__*/_interopDefault(nb_NO);
var ne_NP__default = /*#__PURE__*/_interopDefault(ne_NP);
var nl_BE__default = /*#__PURE__*/_interopDefault(nl_BE);
var nl_NL__default = /*#__PURE__*/_interopDefault(nl_NL);
var pl_PL__default = /*#__PURE__*/_interopDefault(pl_PL);
var pt_BR__default = /*#__PURE__*/_interopDefault(pt_BR);
var pt_PT__default = /*#__PURE__*/_interopDefault(pt_PT);
var ro_RO__default = /*#__PURE__*/_interopDefault(ro_RO);
var ru_RU__default = /*#__PURE__*/_interopDefault(ru_RU);
var si_LK__default = /*#__PURE__*/_interopDefault(si_LK);
var sk_SK__default = /*#__PURE__*/_interopDefault(sk_SK);
var sl_SI__default = /*#__PURE__*/_interopDefault(sl_SI);
var sq_AL__default = /*#__PURE__*/_interopDefault(sq_AL);
var sr_RS__default = /*#__PURE__*/_interopDefault(sr_RS);
var sv_SE__default = /*#__PURE__*/_interopDefault(sv_SE);
var ta_IN__default = /*#__PURE__*/_interopDefault(ta_IN);
var th_TH__default = /*#__PURE__*/_interopDefault(th_TH);
var tk_TK__default = /*#__PURE__*/_interopDefault(tk_TK);
var tr_TR__default = /*#__PURE__*/_interopDefault(tr_TR);
var uk_UA__default = /*#__PURE__*/_interopDefault(uk_UA);
var ur_PK__default = /*#__PURE__*/_interopDefault(ur_PK);
var uz_UZ__default = /*#__PURE__*/_interopDefault(uz_UZ);
var vi_VN__default = /*#__PURE__*/_interopDefault(vi_VN);
var zh_CN__default = /*#__PURE__*/_interopDefault(zh_CN);
var zh_HK__default = /*#__PURE__*/_interopDefault(zh_HK);
var zh_TW__default = /*#__PURE__*/_interopDefault(zh_TW);

const localePacks = {
  ar_EG: ar_EG__default.default,
  az_AZ: az_AZ__default.default,
  bg_BG: bg_BG__default.default,
  bn_BD: bn_BD__default.default,
  by_BY: by_BY__default.default,
  ca_ES: ca_ES__default.default,
  cs_CZ: cs_CZ__default.default,
  da_DK: da_DK__default.default,
  de_DE: de_DE__default.default,
  el_GR: el_GR__default.default,
  en_GB: en_GB__default.default,
  en_US: en_US__default.default,
  es_ES: es_ES__default.default,
  es_US: es_US__default.default,
  et_EE: et_EE__default.default,
  eu_ES: eu_ES__default.default,
  fa_IR: fa_IR__default.default,
  fi_FI: fi_FI__default.default,
  fr_BE: fr_BE__default.default,
  fr_CA: fr_CA__default.default,
  fr_FR: fr_FR__default.default,
  ga_IE: ga_IE__default.default,
  gl_ES: gl_ES__default.default,
  he_IL: he_IL__default.default,
  hi_IN: hi_IN__default.default,
  hr_HR: hr_HR__default.default,
  hu_HU: hu_HU__default.default,
  hy_AM: hy_AM__default.default,
  id_ID: id_ID__default.default,
  is_IS: is_IS__default.default,
  it_IT: it_IT__default.default,
  ja_JP: ja_JP__default.default,
  ka_GE: ka_GE__default.default,
  kk_KZ: kk_KZ__default.default,
  km_KH: km_KH__default.default,
  kmr_IQ: kmr_IQ__default.default,
  kn_IN: kn_IN__default.default,
  ko_KR: ko_KR__default.default,
  ku_IQ: ku_IQ__default.default,
  lt_LT: lt_LT__default.default,
  lv_LV: lv_LV__default.default,
  mk_MK: mk_MK__default.default,
  ml_IN: ml_IN__default.default,
  mn_MN: mn_MN__default.default,
  mr_IN: mr_IN__default.default,
  ms_MY: ms_MY__default.default,
  my_MM: my_MM__default.default,
  nb_NO: nb_NO__default.default,
  ne_NP: ne_NP__default.default,
  nl_BE: nl_BE__default.default,
  nl_NL: nl_NL__default.default,
  pl_PL: pl_PL__default.default,
  pt_BR: pt_BR__default.default,
  pt_PT: pt_PT__default.default,
  ro_RO: ro_RO__default.default,
  ru_RU: ru_RU__default.default,
  si_LK: si_LK__default.default,
  sk_SK: sk_SK__default.default,
  sl_SI: sl_SI__default.default,
  sq_AL: sq_AL__default.default,
  sr_RS: sr_RS__default.default,
  sv_SE: sv_SE__default.default,
  ta_IN: ta_IN__default.default,
  th_TH: th_TH__default.default,
  tk_TK: tk_TK__default.default,
  tr_TR: tr_TR__default.default,
  uk_UA: uk_UA__default.default,
  ur_PK: ur_PK__default.default,
  uz_UZ: uz_UZ__default.default,
  vi_VN: vi_VN__default.default,
  zh_CN: zh_CN__default.default,
  zh_HK: zh_HK__default.default,
  zh_TW: zh_TW__default.default
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
      algorithm: defaultDark ? Ant.theme.darkAlgorithm : void 0,
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
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.ConfigProvider,
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
    /* @__PURE__ */ React__default.default.createElement(Ant.App, { style: { display: "contents" } }, /* @__PURE__ */ React__default.default.createElement(ForkedApp, null, /* @__PURE__ */ React__default.default.createElement(
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
  const { token } = Ant.theme.useToken();
  const makeVarName = (name) => `--antd6-${name}`;
  const cssStyles = React__default.default.useMemo(
    () => `
:root {
  ${Object.entries(token).map(([key, val]) => `${makeVarName(key)}:${normTokenValue(val)};`).join("\n")}
}
  `,
    [token]
  );
  const app = useAppContext();
  const actions = React__default.default.useMemo(
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
  const enableLoadingBoundary = !!host.useSelector(
    "plasmicInternalEnableLoadingBoundary"
  );
  if (!host.GlobalActionsProvider) {
    warnOutdatedDeps();
  }
  let content = host.GlobalActionsProvider ? /* @__PURE__ */ React__default.default.createElement(
    host.GlobalActionsProvider,
    {
      contextName: "plasmic-antd6-config-provider",
      actions
    },
    children
  ) : children;
  if (!removeLoading && enableLoadingBoundary) {
    content = /* @__PURE__ */ React__default.default.createElement(React__default.default.Suspense, null, content);
  }
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, /* @__PURE__ */ React__default.default.createElement("style", { dangerouslySetInnerHTML: { __html: cssStyles } }), content, !removeLoading && /* @__PURE__ */ React__default.default.createElement(GlobalLoadingIndicator, { loadingText }));
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
  const isLoadingRef = React__default.default.useRef(false);
  const isMounted = reactUtils.useIsMounted();
  const showLoading = React__default.default.useCallback(() => {
    if (isMounted() && isLoadingRef.current) {
      app.message.open({
        content: loadingText ?? "Loading...",
        duration: 0,
        key: `plasmic-antd6-global-loading-indicator`
      });
    }
  }, [app, loadingText, isMounted, isLoadingRef]);
  const hideLoading = React__default.default.useCallback(() => {
    setTimeout(() => {
      if (isMounted() && !isLoadingRef.current) {
        app.message.destroy(`plasmic-antd6-global-loading-indicator`);
      }
    }, 500);
  }, [app, isMounted, isLoadingRef]);
  React__default.default.useEffect(() => {
    if (query.addLoadingStateListener) {
      if (isLoadingRef.current) {
        showLoading();
      } else {
        hideLoading();
      }
      return query.addLoadingStateListener(
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
const ForkedAppContext = React__default.default.createContext(void 0);
function useAppContext() {
  const context = React__default.default.useContext(ForkedAppContext);
  if (!context) {
    throw new Error("Must call useAppContext from under ForkedApp");
  }
  return context;
}
function ForkedApp(props) {
  const [messageApi, messageContextHolder] = Ant.message.useMessage();
  const [notificationApi, notificationContextHolder] = Ant.notification.useNotification();
  const appContext = React__default.default.useMemo(
    () => ({
      message: messageApi,
      notification: notificationApi
    }),
    [messageApi, notificationApi]
  );
  return /* @__PURE__ */ React__default.default.createElement(ForkedAppContext.Provider, { value: appContext }, messageContextHolder, notificationContextHolder, props.children);
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
    regs.forEach((t) => registerToken__default.default(t));
  }
}
const registerConfigProvider = utils.makeRegisterGlobalContext(
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

exports.AntdConfigProvider = AntdConfigProvider;
exports.registerConfigProvider = registerConfigProvider;
exports.registerTokens = registerTokens;
exports.themeToAntdConfig = themeToAntdConfig;
//# sourceMappingURL=registerConfigProvider.cjs.js.map
