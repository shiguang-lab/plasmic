import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { newTokenValueAllowed } from "@/wab/client/components/sidebar/token-utils";
import { useClientTokenValue } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { SimpleTextbox } from "@/wab/client/components/widgets/SimpleTextbox";
import { useI18n } from "@/wab/client/i18n";
import TokenIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Token";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTokenRef, tokenTypeDimOpts } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { assert, ensure } from "@/wab/shared/common";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import { useStyleTokenInputs } from "@/wab/client/studio-ctx/style-token-inputs";
import { useShallow } from "zustand/react/shallow";
import * as React from "react";

export const GeneralTokenEditModal = function GeneralTokenModal(props: {
    token: MutableToken<StyleToken> | OverrideableToken<StyleToken>;
    studioCtx: StudioCtx;
    defaultEditingName?: boolean;
    onClose: () => void;
    vsh?: VariantedStylesHelper;
  }) {
    const { t: uiT } = useI18n();
    const {
      token,
      studioCtx,
      defaultEditingName,
      vsh: suppliedVsh,
    } = props;
    const defaultVsh = React.useMemo(() => new VariantedStylesHelper(studioCtx.site), [studioCtx]);
    const vsh = suppliedVsh ?? defaultVsh;
    const lifetime = React.useMemo(() => studioCtx.arenaState.lifetime(), [studioCtx, token]);

    const snapshot = useStyleTokenInputs(studioCtx, token, vsh, useShallow((state) => state && [state.name, state.type, state.activeValue, state.isRegistered, state.regKey] as const));
    const clientValue = useClientTokenValue(
      snapshot && !isTokenRef(snapshot[2]) ? snapshot[2] : undefined,
      snapshot && { isRegistered: snapshot[3], regKey: snapshot[4] },
      lifetime,
    );
    if (!snapshot) { return null; }
    const [tokenName, type, activeTokenValue] = snapshot;
    // Resolve CSS variable refs only
    const tokenRefOrRealColor = isTokenRef(activeTokenValue)
      ? activeTokenValue
      : ensure(clientValue, "Resolved native token value must exist");

    const onChange = async (val: string | undefined) => {
      assert(val !== undefined);
      return studioCtx.changeUnsafe(() => {
        if (newTokenValueAllowed(token, studioCtx.site, val, vsh)) {
          vsh.updateToken(token, val);
        }
      });
    };

    return (
      <SidebarModal
        show={true}
        title={
          <>
            <Icon
              icon={TokenIcon}
              className="token-fg custom-svg-icon--lg monochrome-exempt"
            />
            <SimpleTextbox
              defaultValue={tokenName}
              onValueChange={(name) =>
                studioCtx.changeUnsafe(() => {
                  studioCtx.tplMgr().renameStyleToken(token.base, name);
                })
              }
              readOnly={!(token instanceof MutableToken)}
              placeholder={uiT("(unnamed token)")}
              autoFocus={defaultEditingName}
              selectAllOnFocus={true}
              fontSize="xlarge"
              fontStyle="bold"
            />
          </>
        }
        onClose={() => props.onClose()}
      >
        <div className={"flex-col flex-vcenter p-xlg flex-stretch-items"}>
          <DimTokenSpinner
            value={tokenRefOrRealColor}
            onChange={(val) => onChange(ensure(val, "new value is undefined"))}
            noClear
            studioCtx={studioCtx}
            tokenType={type}
            autoFocus={!defaultEditingName}
            {...tokenTypeDimOpts(type)}
            vsh={vsh}
          />
        </div>
      </SidebarModal>
    );
};
