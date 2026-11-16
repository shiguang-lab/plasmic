import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  BoxGeometryCapabilities,
  BoxGeometryCard,
  isRealBoxDomElement,
  resolveBoxGeometryCapabilities,
} from "@/wab/client/components/style-controls/BoxGeometryCard";
import {
  ExpsProvider,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useInspectorDom } from "@/wab/client/studio-ctx/inspector-state";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import * as React from "react";
import { useStore } from "zustand";

interface BoxGeometrySectionProps {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  enabledStyleSections?: PublicStyleSection[] | boolean;
  readOnly?: boolean;
}

function BoxGeometrySectionBody({
  expsProvider,
  capabilities,
  vsh,
  readOnly,
}: {
  expsProvider: ExpsProvider;
  capabilities: BoxGeometryCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly: boolean;
}) {
  const { active } = useStylePanelLayoutSnapshot(expsProvider, ["width", "height"]);
  if (!active) {
    return null;
  }

  return (
    <SidebarSection
      data-testid="box-geometry-section"
      symmetricNoHeaderPadding
    >
      <FullRow>
        <BoxGeometryCard
          expsProvider={expsProvider}
          capabilities={capabilities}
          vsh={vsh}
          readOnly={readOnly}
        />
      </FullRow>
    </SidebarSection>
  );
}

export function BoxGeometrySection({
  expsProvider,
  vsh,
  missingPositionClass = false,
  contentEditorMode = false,
  enabledStyleSections,
  readOnly = false,
}: BoxGeometrySectionProps) {
  const canEditProject = useStore(
    expsProvider.studioCtx.uiEnvironment.store,
    (state) => state.canEditProject,
  );
  const canEditBranch = useStudioSaveState(
    expsProvider.studioCtx,
    (state) => state.canEditBranch,
  );
  const inspectorDom = useInspectorDom(
    expsProvider instanceof TplExpsProvider ? expsProvider.viewCtx : undefined,
  );
  const hasDomElement = isRealBoxDomElement(inspectorDom ?? expsProvider.forDom());
  const effectiveReadOnly = readOnly || !canEditProject || !canEditBranch;

  const capabilities = resolveBoxGeometryCapabilities({
    expsProvider,
    missingPositionClass,
    contentEditorMode,
    enabledStyleSections,
    readOnly: effectiveReadOnly,
    hasDomElement,
  });

  if (!capabilities.visible) {
    return null;
  }

  return (
    <BoxGeometrySectionBody
      expsProvider={expsProvider}
      capabilities={capabilities}
      vsh={vsh}
      readOnly={effectiveReadOnly}
    />
  );
}
