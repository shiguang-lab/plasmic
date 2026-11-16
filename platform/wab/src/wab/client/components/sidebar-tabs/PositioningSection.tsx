import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  POSITION_STYLE_KEYS,
  PositionCapabilities,
  PositionCard,
  resolvePositionCapabilities,
} from "@/wab/client/components/style-controls/PositionCard";
import { StyleComponentProps } from "@/wab/client/components/style-controls/StyleComponent";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import * as React from "react";
import { useStore } from "zustand";

export interface PositioningPanelSectionProps extends StyleComponentProps {
  capabilities?: PositionCapabilities;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  showTransformQuickBar?: boolean;
}

function PositioningPanelSectionBody(
  props: PositioningPanelSectionProps & {
    preCapabilities: PositionCapabilities;
    readOnly: boolean;
  },
) {
  const {
    expsProvider,
    vsh,
    capabilities: explicitCapabilities,
    preCapabilities,
    readOnly,
  } = props;
  const focusedView = useStudioSelection(
    expsProvider.studioCtx,
    (state) => state.view,
  );
  const layoutSnapshot = useStylePanelLayoutSnapshot(
    expsProvider,
    POSITION_STYLE_KEYS,
    ["display", "flex-direction"],
  );

  if (!layoutSnapshot.active) {
    return null;
  }

  const showRootPositioning = layoutSnapshot.layout?.showPositioning ?? true;
  const capabilities: PositionCapabilities =
    explicitCapabilities ??
    (!showRootPositioning && preCapabilities.visible
      ? {
          visible: true,
          isRootDisabled: true,
          positionEditable: false,
          transformVisible: false,
          transformEditable: false,
          readOnly: true,
        }
      : preCapabilities);

  if (capabilities.isRootDisabled) {
    return (
      <SidebarSection
        data-testid="positioning-section-root-disabled"
        title={
          <LabelWithDetailedTooltip
            tooltip={
              focusedView?.component.pageMeta ? (
                <div>
                  <UiText
                    message={
                      "Positioning controls are disabled on root elements, because a page always takes up the full window."
                    }
                  />
                </div>
              ) : (
                <div>
                  <UiText
                    message={"Positioning controls are disabled on root element."}
                  />{" "}
                  <strong>
                    <UiText
                      message={"Set it on component instances instead."}
                    />
                  </strong>
                </div>
              )
            }
          >
            <UiText message={"Position"} />
          </LabelWithDetailedTooltip>
        }
      />
    );
  }

  return (
    <SidebarSection
      data-testid="positioning-section"
      symmetricNoHeaderPadding
    >
      <FullRow>
        <PositionCard
          expsProvider={expsProvider}
          capabilities={capabilities}
          vsh={vsh}
          readOnly={readOnly}
        />
      </FullRow>
    </SidebarSection>
  );
}

export const PositioningPanelSection = React.memo(
  function PositioningPanelSection(props: PositioningPanelSectionProps) {
    const {
      expsProvider,
      capabilities: explicitCapabilities,
      missingPositionClass = false,
      contentEditorMode = false,
      enabledStyleSections,
      readOnly = false,
      showTransformQuickBar = true,
    } = props;

    const canEditProject = useStore(
      expsProvider.studioCtx.uiEnvironment.store,
      (state) => state.canEditProject,
    );
    const canEditBranch = useStudioSaveState(
      expsProvider.studioCtx,
      (state) => state.canEditBranch,
    );
    const effectiveReadOnly = readOnly || !canEditProject || !canEditBranch;

    const capabilities =
      explicitCapabilities ??
      resolvePositionCapabilities({
        expsProvider,
        missingPositionClass,
        contentEditorMode,
        enabledStyleSections,
        readOnly: effectiveReadOnly,
        showTransformQuickBar,
      });

    if (!capabilities.visible) {
      return null;
    }

    return (
      <PositioningPanelSectionBody
        {...props}
        preCapabilities={capabilities}
        readOnly={effectiveReadOnly}
      />
    );
  },
);
