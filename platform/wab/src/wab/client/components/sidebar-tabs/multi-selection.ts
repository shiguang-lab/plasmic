import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import {
  BOX_STYLE_KEYS,
  BoxGeometryCapabilities,
  BoxGeometryMultiValue,
  isRealBoxDomElement,
  resolveBoxGeometryCapabilities,
} from "@/wab/client/components/style-controls/BoxGeometryCard";
import {
  canEditSection,
  isCodeComponentMissingPositionClass,
  Section,
} from "@/wab/client/components/sidebar-tabs/Sections";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import { isValidStylePropForTpl } from "@/wab/shared/core/style-props-tpl";
import {
  isTplCodeComponent,
  isTplVariantable,
  resolveTplRoot,
} from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { getTargetBlockingCombo } from "@/wab/shared/defined-indicator";
import { standardCorners } from "@/wab/shared/geom";
import { uniq } from "lodash";

export const multiSelectionFields = {
  width: {
    label: "Width",
    section: Section.Size,
    publicSection: PublicStyleSection.Sizing,
  },
  height: {
    label: "Height",
    section: Section.Size,
    publicSection: PublicStyleSection.Sizing,
  },
  opacity: {
    label: "Opacity",
    section: Section.Visibility,
    publicSection: PublicStyleSection.Visibility,
  },
  "border-radius": {
    label: "Border radius",
    section: Section.Border,
    publicSection: PublicStyleSection.Border,
  },
  "font-size": {
    label: "Font size",
    section: Section.Typography,
    publicSection: PublicStyleSection.Typography,
  },
  color: {
    label: "Color",
    section: Section.Typography,
    publicSection: PublicStyleSection.Typography,
  },
} as const;
export type MultiSelectionProp = keyof typeof multiSelectionFields;

function styleProps(prop: string) {
  return prop === "border-radius"
    ? standardCorners.map((corner) => `border-${corner}-radius`)
    : [prop];
}

export function getMultiSelectionProviders(viewCtx: ViewCtx) {
  return uniq(viewCtx.focusedTpls()).flatMap((tpl) =>
    tpl && isTplVariantable(tpl) ? [new TplExpsProvider(viewCtx, tpl)] : [],
  );
}

export function getCommonStyleValue(
  providers: TplExpsProvider[],
  prop: string,
) {
  const values = providers.flatMap((provider) =>
    styleProps(prop).map((styleProp) => provider.mergedExp().get(styleProp)),
  );
  const mixed = values.some((value) => value !== values[0]);
  return { value: mixed ? undefined : values[0], mixed };
}

/** Native access supplied by the rendering component. Command-time calls omit
 * it so the unique policy reads the current canonical Studio permission. */
export interface MultiSelectionEditAccess {
  readonly canEditProject: boolean;
  readonly canEditBranch: boolean;
}

export function getMultiSelectionFieldState(
  viewCtx: ViewCtx,
  providers: TplExpsProvider[],
  prop: MultiSelectionProp,
  access?: MultiSelectionEditAccess,
) {
  const studioCtx = viewCtx.studioCtx;
  const canEditProject = access?.canEditProject ?? studioCtx.canEditProject();
  const canEditBranch = access?.canEditBranch ?? studioCtx.canEditBranch();
  const field = multiSelectionFields[prop];
  const selectables = viewCtx.focusedSelectables();
  const supported =
    providers.length > 0 &&
    providers.length === uniq(viewCtx.focusedTpls()).length &&
    canEditSection(studioCtx, field.section) &&
    providers.every((provider) => {
      const root = resolveTplRoot(provider.tpl);
      if (isTplCodeComponent(root)) {
        const sections = viewCtx.getTplCodeComponentMeta(root)?.styleSections;
        if (
          !isTplCodeComponentStyleable(
            studioCtx.codeComponentsRegistry,
            root,
          ) ||
          (Array.isArray(sections) && !sections.includes(field.publicSection))
        ) {
          return false;
        }
      }
      return styleProps(prop).every((styleProp) =>
        isValidStylePropForTpl(
          styleProp,
          provider.tpl,
          provider.mergedExp(),
          studioCtx.codeComponentsRegistry,
        ),
      );
    });
  const disabled =
    !supported ||
    !canEditProject ||
    !canEditBranch ||
    selectables.some((sel) => {
      if (!sel || isSelectableLocked(sel, viewCtx.valState())) {
        return true;
      }
      if (
        sel instanceof ValComponent &&
        isCodeComponentMissingPositionClass(viewCtx, sel)
      ) {
        const root = resolveTplRoot(sel.tpl);
        return (
          !isTplCodeComponent(root) ||
          viewCtx.getTplCodeComponentMeta(root)?.styleSections !== true
        );
      }
      return false;
    }) ||
    !!getTargetBlockingCombo(
      providers.flatMap((provider) =>
        styleProps(prop).map((styleProp) =>
          provider.definedIndicator(styleProp),
        ),
      ),
    );
  return { ...getCommonStyleValue(providers, prop), supported, disabled };
}

/** Use each node's recording variant and one Studio transaction for the whole edit. */
export function setMultiSelectionStyle(
  viewCtx: ViewCtx,
  prop: MultiSelectionProp,
  value: string | undefined,
) {
  const providers = getMultiSelectionProviders(viewCtx);
  if (getMultiSelectionFieldState(viewCtx, providers, prop).disabled) {
    return Promise.resolve();
  }
  return viewCtx.change(() => {
    for (const provider of providers) {
      for (const styleProp of styleProps(prop)) {
        if (value === undefined) {
          provider.maybeTargetExp()?.clear(styleProp);
        } else {
          provider.targetExp().set(styleProp, value);
        }
      }
    }
  });
}

export function getMultiSelectionBoxGeometryState(
  viewCtx: ViewCtx,
  providers: TplExpsProvider[],
  access?: MultiSelectionEditAccess,
): {
  capabilities: BoxGeometryCapabilities;
  values: Record<string, BoxGeometryMultiValue>;
} {
  const studioCtx = viewCtx.studioCtx;
  const canEditProject = access?.canEditProject ?? studioCtx.canEditProject();
  const canEditBranch = access?.canEditBranch ?? studioCtx.canEditBranch();
  const selectables = viewCtx.focusedSelectables();
  const valState = viewCtx.valState();

  const hiddenCaps: BoxGeometryCapabilities = {
    visible: false,
    margin: { editable: false },
    padding: { editable: false },
    radius: { editable: false },
    size: { readable: false, editable: false },
    readOnly: true,
  };

  if (
    providers.length === 0 ||
    providers.length !== uniq(viewCtx.focusedTpls()).length
  ) {
    return { capabilities: hiddenCaps, values: {} };
  }

  const anyLocked = selectables.some(
    (sel) => !sel || isSelectableLocked(sel, valState),
  );
  const projectOrBranchLocked = !canEditProject || !canEditBranch;

  const perProviderCaps = providers.map((provider, idx) => {
    const sel = selectables[idx];
    const missingPositionClass =
      sel instanceof ValComponent
        ? isCodeComponentMissingPositionClass(viewCtx, sel)
        : false;
    const selDom = sel
      ? viewCtx.selectionDom?.(sel, viewCtx.sel2cloneKey?.(sel)) ??
        viewCtx.renderState?.sel2dom?.(sel, viewCtx.canvasCtx) ??
        provider.forDom()
      : provider.forDom();
    return resolveBoxGeometryCapabilities({
      expsProvider: provider,
      missingPositionClass,
      contentEditorMode: studioCtx.contentEditorMode,
      readOnly: projectOrBranchLocked,
      locked: anyLocked,
      ignoreSelectionEditCheck: true,
      hasDomElement: isRealBoxDomElement(selDom),
    });
  });

  if (perProviderCaps.some((cap) => !cap.visible)) {
    return { capabilities: hiddenCaps, values: {} };
  }

  const spacingAllowed = canEditSection(studioCtx, Section.Spacing);
  const borderAllowed = canEditSection(studioCtx, Section.Border);
  const sizeAllowed = canEditSection(studioCtx, Section.Size);

  const marginEditable =
    spacingAllowed && perProviderCaps.every((c) => c.margin.editable);
  const paddingEditable =
    spacingAllowed && perProviderCaps.every((c) => c.padding.editable);
  const radiusEditable =
    borderAllowed && perProviderCaps.every((c) => c.radius.editable);
  const sizeEditable =
    sizeAllowed && perProviderCaps.every((c) => c.size.editable);

  const firstMarginBlock = perProviderCaps.find((c) => !c.margin.editable)?.margin.reason;
  const firstPaddingBlock = perProviderCaps.find((c) => !c.padding.editable)?.padding.reason;
  const firstRadiusBlock = perProviderCaps.find((c) => !c.radius.editable)?.radius.reason;
  const firstSizeBlock = perProviderCaps.find((c) => !c.size.editable)?.size.reason;
  const firstReadOnlyReason = perProviderCaps.find((c) => c.readOnlyReason)?.readOnlyReason;

  const allReadOnly =
    projectOrBranchLocked ||
    anyLocked ||
    (!marginEditable && !paddingEditable && !radiusEditable);

  const capabilities: BoxGeometryCapabilities = {
    visible: true,
    margin: {
      editable: marginEditable,
      reason: marginEditable
        ? undefined
        : firstMarginBlock ?? "Spacing editing is disabled",
    },
    padding: {
      editable: paddingEditable,
      reason: paddingEditable
        ? undefined
        : firstPaddingBlock ?? "Spacing editing is disabled",
    },
    radius: {
      editable: radiusEditable,
      reason: radiusEditable
        ? undefined
        : firstRadiusBlock ?? "Corner radius editing is disabled",
    },
    size: {
      readable: true,
      editable: sizeEditable,
      reason: sizeEditable ? undefined : firstSizeBlock ?? "Size is read-only",
    },
    readOnly: allReadOnly,
    readOnlyReason: allReadOnly
      ? anyLocked
        ? "Element is locked"
        : projectOrBranchLocked
          ? "Read-only mode"
          : firstReadOnlyReason ?? "Box properties are read-only for this element"
      : undefined,
  };

  const values: Record<string, BoxGeometryMultiValue> = {};
  for (const key of BOX_STYLE_KEYS) {
    const rawValues = providers.map((provider) => provider.mergedExp().get(key));
    const mixed = rawValues.some((val) => val !== rawValues[0]);
    const blocked = providers.some(
      (provider) => !!getTargetBlockingCombo([provider.definedIndicator(key)]),
    );
    const set = providers.some(
      (provider) => provider.definedIndicator(key).source === "set",
    );
    values[key] = {
      value: mixed ? "" : (rawValues[0] ?? ""),
      mixed,
      blocked,
      set,
    };
  }

  return { capabilities, values };
}

export function setMultiSelectionBoxProps(
  viewCtx: ViewCtx,
  entries: ReadonlyArray<readonly [string, string]>,
) {
  const providers = getMultiSelectionProviders(viewCtx);
  const state = getMultiSelectionBoxGeometryState(viewCtx, providers);
  if (!state.capabilities.visible || state.capabilities.readOnly) {
    return Promise.resolve();
  }
  const editableEntries = entries.filter(([prop]) => {
    if (prop.startsWith("margin-")) {
      return state.capabilities.margin.editable && !state.values[prop]?.blocked;
    }
    if (prop.startsWith("padding-")) {
      return state.capabilities.padding.editable && !state.values[prop]?.blocked;
    }
    if (prop.startsWith("border-") && prop.endsWith("-radius")) {
      return state.capabilities.radius.editable && !state.values[prop]?.blocked;
    }
    return false;
  });
  if (editableEntries.length === 0) {
    return Promise.resolve();
  }
  return viewCtx.change(() => {
    for (const provider of providers) {
      const exp = provider.targetExp();
      for (const [prop, val] of editableEntries) {
        exp.set(prop, val);
      }
    }
  });
}
