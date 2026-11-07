import { newTokenValueAllowed } from "@/wab/client/components/sidebar/token-utils";
import { ColorSidebarPopup } from "@/wab/client/components/style-controls/ColorButton";
import { useClientTokenValue } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { SimpleTextbox } from "@/wab/client/components/widgets/SimpleTextbox";
import { useI18n } from "@/wab/client/i18n";
import TokenIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Token";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTokenRef } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { useStyleColorTokens } from "@/wab/client/studio-ctx/style-color-token-inputs";
import { useStyleTokenInputs } from "@/wab/client/studio-ctx/style-token-inputs";
import { useShallow } from "zustand/react/shallow";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import { ok } from "neverthrow";
import React from "react";

export const ColorTokenPopup = function ColorTokenPopup(props: {
  token: MutableToken<StyleToken> | OverrideableToken<StyleToken>;
  studioCtx: StudioCtx;
  show: boolean;
  onClose: () => void;
  autoFocusName?: boolean;
  vsh?: VariantedStylesHelper;
}) {
  const { t: uiT } = useI18n();
  const {
    token,
    studioCtx,
    show,
    onClose,
    autoFocusName,
    vsh: suppliedVsh,
  } = props;

  const defaultVsh = React.useMemo(() => new VariantedStylesHelper(studioCtx.site), [studioCtx]);
  const vsh = suppliedVsh ?? defaultVsh;
  const lifetime = React.useMemo(() => studioCtx.arenaState.lifetime(), [studioCtx, token]);
  const nativeToken = useStyleTokenInputs(studioCtx, token, vsh, useShallow((state) => state && [state.name, state.activeValue, state.isRegistered, state.regKey] as const));
  const colors = useStyleColorTokens(studioCtx, token);
  const clientValue = useClientTokenValue(
    nativeToken && !isTokenRef(nativeToken[1]) ? nativeToken[1] : undefined,
    nativeToken && { isRegistered: nativeToken[2], regKey: nativeToken[3] },
    lifetime,
  );
  // The editor belongs to its captured world, including its opaque picker
  // handles. Leave that scope before child resolvers can see another world.
  if (!nativeToken || !colors.snapshot.active || lifetime.aborted) { return null; }
  const [tokenName, activeTokenValue] = nativeToken;
  const tokenRefOrRealColor = isTokenRef(activeTokenValue) ? activeTokenValue : clientValue;

  return (
    <ColorSidebarPopup
      color={tokenRefOrRealColor}
      onChange={async (newColor) => {
        if (newTokenValueAllowed(token, studioCtx.site, newColor, vsh)) {
          await studioCtx.changeUnsafe(() => vsh.updateToken(token, newColor));
        }
      }}
      show={show}
      onClose={() => onClose()}
      autoFocus={!autoFocusName}
      colorTokens={colors.commands}
      popupTitle={
        <>
          <Icon
            icon={TokenIcon}
            className="token-fg custom-svg-icon--lg monochrome-exempt"
          />

          <SimpleTextbox
            defaultValue={tokenName}
            onValueChange={(name) =>
              studioCtx.change(() => {
                studioCtx.tplMgr().renameStyleToken(token.base, name);
                return ok();
              })
            }
            readOnly={!(token instanceof MutableToken)}
            placeholder={uiT("(unnamed token)")}
            autoFocus={autoFocusName}
            selectAllOnFocus={true}
            fontSize="xlarge"
            fontStyle="bold"
          />
        </>
      }
      vsh={vsh}
    />
  );
};
