import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  readVisibility,
  useVisibilityController,
} from "@/wab/client/components/sidebar-tabs/VisibilitySection";
import {
  AppearanceCapabilities,
  AppearanceCard,
  resolveAppearanceCapabilities,
} from "@/wab/client/components/style-controls/AppearanceCard";
import {
  ExpsProvider,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { useTargetedStylePanelValue } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { canToggleVisibility } from "@/wab/shared/core/tpls";
import * as React from "react";
import { useStore } from "zustand";

interface AppearancePanelSectionProps {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  enabledStyleSections?: PublicStyleSection[] | boolean;
  readOnly?: boolean;
}

function AppearancePanelSectionStyleOnly({
  expsProvider,
  capabilities,
  vsh,
  readOnly,
}: {
  expsProvider: ExpsProvider;
  capabilities: AppearanceCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly: boolean;
}) {
  const { active } = useStylePanelLayoutSnapshot(expsProvider, ["opacity"]);
  if (!active) {
    return null;
  }

  return (
    <SidebarSection
      data-testid="appearance-section"
      symmetricNoHeaderPadding
    >
      <FullRow>
        <AppearanceCard
          expsProvider={expsProvider}
          capabilities={capabilities}
          vsh={vsh}
          readOnly={readOnly}
        />
      </FullRow>
    </SidebarSection>
  );
}

function AppearancePanelSectionWithVisibilityInner({
  expsProvider,
  capabilities,
  vsh,
  readOnly,
  visibilityInput,
}: {
  expsProvider: TplExpsProvider;
  capabilities: AppearanceCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly: boolean;
  visibilityInput: ReturnType<typeof readVisibility>;
}) {
  const { active } = useStylePanelLayoutSnapshot(expsProvider, ["opacity"]);
  const visibilityController = useVisibilityController({
    tpl: expsProvider.tpl,
    viewCtx: expsProvider.viewCtx,
    expsProvider,
    visibilityInput,
  });

  if (!active) {
    return null;
  }

  return (
    <SidebarSection
      data-testid="appearance-section"
      symmetricNoHeaderPadding
    >
      <FullRow>
        <AppearanceCard
          expsProvider={expsProvider}
          capabilities={capabilities}
          visibilityController={visibilityController}
          vsh={vsh}
          readOnly={readOnly}
        />
      </FullRow>
    </SidebarSection>
  );
}

function AppearancePanelSectionWithVisibility({
  expsProvider,
  capabilities,
  vsh,
  readOnly,
}: {
  expsProvider: TplExpsProvider;
  capabilities: AppearanceCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly: boolean;
}) {
  const select = React.useCallback(
    () => readVisibility(expsProvider.viewCtx, expsProvider.tpl, expsProvider),
    [expsProvider],
  );
  const source = useTargetedStylePanelValue(
    expsProvider.viewCtx.studioCtx,
    {
      kind: "visibility",
      view: expsProvider.viewCtx,
      tpl: expsProvider.tpl,
    },
    select,
  );
  if (!source.active || !source.value) {
    return null;
  }

  return (
    <AppearancePanelSectionWithVisibilityInner
      expsProvider={expsProvider}
      capabilities={capabilities}
      vsh={vsh}
      readOnly={readOnly}
      visibilityInput={source.value}
    />
  );
}

export function AppearancePanelSection({
  expsProvider,
  vsh,
  missingPositionClass = false,
  contentEditorMode = false,
  enabledStyleSections,
  readOnly = false,
}: AppearancePanelSectionProps) {
  const canEditProject = useStore(
    expsProvider.studioCtx.uiEnvironment.store,
    (state) => state.canEditProject,
  );
  const canEditBranch = useStudioSaveState(
    expsProvider.studioCtx,
    (state) => state.canEditBranch,
  );
  const effectiveReadOnly = readOnly || !canEditProject || !canEditBranch;

  const canVis =
    expsProvider instanceof TplExpsProvider &&
    canToggleVisibility(expsProvider.tpl, expsProvider.viewCtx);

  const capabilities = resolveAppearanceCapabilities({
    expsProvider,
    canToggleVisibility: canVis,
    missingPositionClass,
    contentEditorMode,
    enabledStyleSections,
    readOnly: effectiveReadOnly,
  });

  if (!capabilities.visible) {
    return null;
  }

  if (capabilities.visibilityVisible && expsProvider instanceof TplExpsProvider) {
    return (
      <AppearancePanelSectionWithVisibility
        expsProvider={expsProvider}
        capabilities={capabilities}
        vsh={vsh}
        readOnly={effectiveReadOnly}
      />
    );
  }

  return (
    <AppearancePanelSectionStyleOnly
      expsProvider={expsProvider}
      capabilities={capabilities}
      vsh={vsh}
      readOnly={effectiveReadOnly}
    />
  );
}
