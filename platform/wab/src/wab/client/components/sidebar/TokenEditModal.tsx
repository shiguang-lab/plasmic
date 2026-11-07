import { ColorTokenPopup } from "@/wab/client/components/sidebar/ColorTokenPopup";
import { FontFamilyTokenEditModal } from "@/wab/client/components/sidebar/FontFamilyTokenEditModal";
import { GeneralTokenEditModal } from "@/wab/client/components/sidebar/GeneralTokenEditModal";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";

export const TokenEditModal = function TokenEditModal(props: {
  studioCtx: StudioCtx;
  token: MutableToken<StyleToken> | OverrideableToken<StyleToken>;
  onClose: () => void;
  autoFocusName?: boolean;
  vsh?: VariantedStylesHelper;
}) {
  const { studioCtx, token, onClose, autoFocusName, vsh } = props;
  const type = useStore(studioCtx.modelSnapshots.field(token.base, "type"));

  return (
    <>
      {type === "Color" && (
        <ColorTokenPopup
          studioCtx={studioCtx}
          token={token}
          show={true}
          onClose={onClose}
          autoFocusName={autoFocusName}
          vsh={vsh}
        />
      )}

      {type === "FontFamily" && (
        <FontFamilyTokenEditModal
          studioCtx={studioCtx}
          token={token}
          defaultEditingName={autoFocusName}
          onClose={onClose}
          vsh={vsh}
        />
      )}

      {type !== "Color" && type !== "FontFamily" && (
        <GeneralTokenEditModal
          studioCtx={studioCtx}
          token={token}
          defaultEditingName={autoFocusName}
          onClose={onClose}
          vsh={vsh}
        />
      )}
    </>
  );
};
