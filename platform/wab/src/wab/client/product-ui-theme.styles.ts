import textbox from "@/wab/client/plasmic/plasmic_kit/PlasmicTextbox.module.css";
import select from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect.module.css";
import type { GlobalToken } from "antd";
import { createStyles } from "antd-style";

// These tokens belong to the product's generated UI library. Scoped binding
// keeps the shared application/editor palette out of business iframe documents.
export const productPalette = (token: GlobalToken) => ({
  "& .labeled-item__label": { color: token.colorText },
  "& .btn-link": { color: token.colorText },
  "& .btn-link:disabled": { color: token.colorTextDisabled },
  "& .form-control, & .textboxlike, & .templated-string-input, & .image-paster":
    {
      background: token.colorBgContainer,
      color: token.colorText,
      borderColor: token.colorBorder,
    },
  "& .templated-string-input:hover": { background: token.colorFillTertiary },
  "& .templated-string-input:focus, & .image-paster:focus": {
    borderColor: token.colorPrimary,
  },
  "& .image-paster::placeholder": { color: token.colorTextPlaceholder },
  "& .panel-dim-block": {
    background: token.colorBgLayout,
    color: token.colorText,
  },
  "& .file-uploader": { borderColor: token.colorBorder },
  "& .file-uploader:hover": { background: token.colorFillTertiary },
  "& .file-uploader .fake-upload": { color: token.colorTextSecondary },
  "& .plasmic_tokens_95xp9cYcv7HrNWpFWWhbcv": {
    "--token-iR8SeEwQZ": token.colorBgContainer,
    "--token-9jh0BkCENS": token.colorBgContainer,
    "--token-p-rw5DRJTx": token.colorBgLayout,
    "--token-O4S7RMTqZ3": token.colorFillQuaternary,
    "--token-bV4cCeIniS6": token.colorFillTertiary,
    "--token-Ik3bdE1e1Uy": token.colorFillSecondary,
    "--token-hoA5qaM-91G": token.colorBorderSecondary,
    "--token-VBhAy2b-S": token.colorBorderSecondary,
    "--token-eBt2ZgqRUCz": token.colorBorder,
    "--token-PTyaboLP9ZK": token.colorTextQuaternary,
    "--token-fVn5vRhXJxQ": token.colorTextTertiary,
    "--token-qKhMu66CwSx": token.colorTextSecondary,
    "--token-UunsGa2Y3t3": token.colorTextSecondary,
    "--token-0IloF6TmFvF": token.colorText,
    "--token-dqEx_KxIoYV": token.colorPrimaryBg,
    "--token-qP8a3gYPq7fd": token.colorPrimary,
    "--token-HKVCQ5ZKovK": token.colorPrimaryBg,
    "--token-Le11TVejD2x2": token.colorError,
    "--token-5kjtdCiiOPB": token.colorPrimaryBgHover,
    "--token-ElMeFHrIrKT": token.colorText,
    "--token-h3n_6qpT3Tc4": token.colorFillTertiary,
    "--token-D666zt2IZPL": token.colorPrimary,
    "--token-mu3x63xzJRW": token.colorPrimaryHover,
    "--token-VUsIDivgUss": token.colorPrimaryText,
    "--token-yqAf_E0HIjU": token.colorPrimaryBg,
    "--token-JfSQu2FXX0v": token.colorPrimaryBorder,
    "--token-WqsKGtAj1ZMI": token.colorPrimary,
    "--token-iRjO5KzKh1e_": token.colorBgElevated,
    "--token-S8OnTYk9S2Q": token.colorError,
    "--token-SJeRSg5mW91": token.colorErrorBg,
    "--token-pH5HkOAVcYh": token.colorErrorBorder,
    "--token-oI9RmKl5Rl_y": token.colorSuccess,
    "--token-qEDJedw9WWX8": token.colorSuccessBg,
    "--token-LsPj_iMMTYwZ": token.colorSuccessBorder,
    "--token-DEbwNasuLfjs": token.colorWarning,
    "--token-WsutfVbnQWpY": token.colorWarningBg,
    "--token-680C9kW9i_xC": token.colorWarningBorder,
    "--token-N-GFU-C_NPxa": token.colorWarningText,
  },
  "& .plasmic_tokens_dyzP6dbCdycwJpqiR2zkwe": {
    "--token-CWv8jfhWh": token.colorBorderSecondary,
    "--token-aUCjnzhayS": token.colorBgContainer,
    "--token-nadNyMOsLjl": token.colorTextSecondary,
    "--token-0KXajUKTVZC": token.colorText,
    "--token-dBnk53GtPsb": token.colorTextTertiary,
    "--token-B77WAT17jl8": token.colorBorder,
    "--token-pryzRkTNOFd": token.colorBgLayout,
    "--token-7bUFmc-GkpN": token.colorFillSecondary,
    "--token-6-fKAK7Ga33": token.colorPrimary,
    "--token-2H3KashplBE": token.colorPrimaryHover,
    "--token-txY5tRAWqAc": token.colorPrimaryText,
  },
  "& .plasmic_tokens_fpbcKyXdMTvY59T4C5fjcC": {
    "--token-0vHxN11ixM": token.colorBorderSecondary,
    "--token-t68i-MG5Bw": token.colorTextSecondary,
    "--token-pCMcQv3xBc": token.colorText,
    "--token-tqZN8CQTuKc": token.colorTextTertiary,
    "--token-HgOUo1yKGd7": token.colorBorderSecondary,
    "--token-p7qUpYIr0s0": token.colorBgLayout,
    "--token-NxA0xIzktpH": token.colorTextSecondary,
    "--token-NcVkVEFwiIx": token.colorText,
    "--token-fFqkXw6j9cb": token.colorBorder,
    "--token-XH9PcvIOG8Q": token.colorPrimaryText,
    "--token-QMdL41TrGn5": token.colorErrorBg,
    "--token-ogRzOcay4E5": token.colorWarningBg,
    "--token-590x3zVVS2z": token.colorError,
    "--token-koLTWNKDmAp": token.colorSuccess,
    "--token-6QEhTkH8umI": token.colorError,
    "--token-MUeFl9R6QY0": token.colorSuccessText,
    "--token-QrwPbjkKitC": token.colorErrorText,
    "--token-BvJVLj75Y27": token.colorErrorText,
    "--token-uNUqZL6OMn5": token.colorWarningText,
    "--token-CYqwMJchyYA": token.colorTextTertiary,
  },
  [`& .${select.trigger}, & .${select.contentContainer}, & .${select.slotTargetSelectedContent}`]:
    { color: token.colorText },
  [`& .${select.slotTargetSelectedContentshowPlaceholder}`]: {
    color: token.colorTextPlaceholder,
  },
  [`& .${textbox.textbox}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${textbox.textboxdisabled}`]: {
    background: token.colorBgContainerDisabled,
    color: token.colorTextDisabled,
  },
  "& .plasmic_tokens_tXkSR39sgCDWSitZxC5xFV": {
    "--token-iCBCh1BQyu-W": token.colorFillQuaternary,
    "--token-11LpBV8ry6Ok": token.colorFillSecondary,
  },
});

export const useProductThemeStyles = createStyles(
  (_context, token: GlobalToken) => ({
    root: productPalette(token),
  }),
);
