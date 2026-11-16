import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  LAYOUT_STYLE_KEYS,
  LayoutCapabilities,
  LayoutCard,
  resolveLayoutCapabilities,
} from "@/wab/client/components/style-controls/LayoutCard";
import { StyleComponentProps } from "@/wab/client/components/style-controls/StyleComponent";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import * as React from "react";
import { useStore } from "zustand";

export interface LayoutPanelSectionProps extends StyleComponentProps {
  capabilities?: LayoutCapabilities;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  allowConvert?: boolean;
}

function LayoutPanelSectionBody(
  props: LayoutPanelSectionProps & {
    readOnly: boolean;
  },
) {
  const {
    expsProvider,
    vsh,
    capabilities: explicitCapabilities,
    missingPositionClass = false,
    contentEditorMode = false,
    enabledStyleSections,
    allowConvert = true,
    readOnly,
  } = props;

  const layoutSnapshot = useStylePanelLayoutSnapshot(
    expsProvider,
    LAYOUT_STYLE_KEYS,
    ["display", "flex-direction"],
  );

  if (!layoutSnapshot.active) {
    return null;
  }

  const capabilities =
    explicitCapabilities ??
    resolveLayoutCapabilities({
      expsProvider,
      missingPositionClass,
      contentEditorMode,
      enabledStyleSections,
      readOnly,
      allowConvert,
      parentContainerType: layoutSnapshot.parentContainerType,
    });

  if (!capabilities.visible) {
    return null;
  }

  return (
    <SidebarSection
      data-testid="layout-section"
      symmetricNoHeaderPadding
    >
      <FullRow>
        <LayoutCard
          expsProvider={expsProvider}
          capabilities={capabilities}
          vsh={vsh}
          readOnly={readOnly}
          allowConvert={allowConvert}
        />
      </FullRow>
    </SidebarSection>
  );
}

export const LayoutPanelSection = React.memo(function LayoutPanelSection(
  props: LayoutPanelSectionProps,
) {
  const {
    expsProvider,
    capabilities: explicitCapabilities,
    missingPositionClass = false,
    contentEditorMode = false,
    enabledStyleSections,
    readOnly = false,
    allowConvert = true,
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

  const preCapabilities =
    explicitCapabilities ??
    resolveLayoutCapabilities({
      expsProvider,
      missingPositionClass,
      contentEditorMode,
      enabledStyleSections,
      readOnly: effectiveReadOnly,
      allowConvert,
    });

  if (!preCapabilities.visible) {
    return null;
  }

  return <LayoutPanelSectionBody {...props} readOnly={effectiveReadOnly} />;
});
