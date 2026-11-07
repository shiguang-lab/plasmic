import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import {
  StyleVariantEditor,
  VariantLabel,
  makeCanvasVariantContextMenu,
} from "@/wab/client/components/VariantControls";
import styles from "@/wab/client/components/canvas/VariantsBar/VariantBadge.module.scss";
import { EditableLabelHandles } from "@/wab/client/components/widgets/EditableLabel";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  DefaultVariantBadgeProps,
  PlasmicVariantBadge,
} from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantBadge";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import { StyleVariant } from "@/wab/shared/Variants";
import { Component, Variant } from "@/wab/shared/model/classes";
import { Popover } from "antd";
import { useStore } from "zustand";
import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

interface VariantBadgeProps extends DefaultVariantBadgeProps {
  variant: Variant;
  onToggle?: (e: React.MouseEvent) => void;
  onUnpin?: () => void;
  superComp?: Component;
  component: Component;
}

function VariantBadge({
  onUnpin,
  onToggle,
  variant,
  superComp,
  component,
  ...props
}: VariantBadgeProps) {
  const studioCtx = useStudioCtx();
  const isLatest = useStore(studioCtx.latestVariantCreatedStore, (ref) => ref?.uid === variant.uid);
  const hasSelectors = useStore(studioCtx.modelSnapshots.field(variant, "selectors"), (selectors) => !!selectors);
  const hasCodeName = useStore(studioCtx.modelSnapshots.field(variant, "codeComponentName"), (name) => !!name);
  const hasCodeKeys = useStore(studioCtx.modelSnapshots.field(variant, "codeComponentVariantKeys"), (keys) => !!keys);
  const editsSelectors = hasSelectors || (hasCodeName && hasCodeKeys);
  const variantLabelRef = useRef<EditableLabelHandles>(null);
  const [showStyleVariantEditor, setShowStyleVariantEditor] = useState(false);

  useLayoutEffect(() => {
    if (isLatest) {
      if (editsSelectors) {
        setShowStyleVariantEditor(true);
      } else {
        variantLabelRef.current?.setEditing(true);
      }
      studioCtx.latestVariantCreated = undefined;
    }
  }, [isLatest, editsSelectors, studioCtx]);

  return (
    <PlasmicVariantBadge
      {...props}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      root={{
        onClick: onToggle,
        onContextMenu: (e: any) => {
          maybeShowContextMenu(
            e,
            makeCanvasVariantContextMenu({
              studioCtx,
              variant,
              component,
              onRequestEditing: () => {
                if (editsSelectors) {
                  setShowStyleVariantEditor(true);
                } else {
                  variantLabelRef.current?.setEditing(true);
                }
              },
            }),
          );
        },
      }}
      removeIcon={{
        onClick: (e) => {
          e.stopPropagation();
          onUnpin?.();
        },
      }}
    >
      <MaybeWrap
        cond={editsSelectors}
        wrapper={(children) => (
          <Popover
            placement="left"
            motion={{ motionName: "" }}
            open={showStyleVariantEditor}
            content={() => (
              <StyleVariantEditor
                variant={variant as StyleVariant}
                component={component}
                onDismiss={() => setShowStyleVariantEditor(false)}
              />
            )}
          >
            <TriggerTarget>{children}</TriggerTarget>
          </Popover>
        )}
      >
        <VariantLabel
          ref={variantLabelRef}
          programmaticallyTriggered
          inputBoxClassName={styles.variantLabelInput}
          variant={variant}
          useGroupNameForSplits
        />
      </MaybeWrap>
    </PlasmicVariantBadge>
  );
}

export default VariantBadge;
