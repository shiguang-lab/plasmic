import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import {
  LabeledStyleColorItemRow,
  LabeledStyleDimItemRow,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { LabeledLineStyleToggleButtonGroupItemRow } from "@/wab/client/components/style-controls/LineStyleControls";
import {
  StylePanelSection,
  useStyleTarget,
} from "@/wab/client/components/style-controls/StyleComponent";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { isStyleOrCodeComponentVariant } from "@/wab/shared/Variants";
import { LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { Alert } from "antd";
import { ok } from "neverthrow";
import React from "react";

enum OutlineProps {
  style = "outline-style",
  width = "outline-width",
  offset = "outline-offset",
  color = "outline-color",
}

export const outlineStyleProps = [
  OutlineProps.style,
  OutlineProps.width,
  OutlineProps.offset,
  OutlineProps.color,
];

interface OutlineVariantInput {
  subscribe(listener: () => void): () => void;
}

/** The warning's finite inputs. Combo normalization and variant classification
 * stay in their existing helpers; CSS/token children own their own inputs. */
function readOutlineVariantInputs(view: ViewCtx) {
  const models = view.studioCtx.modelSnapshots;
  const frame = view.currentComponentStackFrame();
  const inputs = new Set<OutlineVariantInput>([view.variantStore, models.field(frame.component, "variants")]);
  const variants = new Set([
    ...frame.component.variants,
    ...frame.getTargetVariants(),
    ...view.globalFrame.getTargetVariants(),
  ]);
  for (const variant of variants) {
    inputs.add(models.field(variant, "name"));
    inputs.add(models.field(variant, "uuid"));
    inputs.add(models.field(variant, "parent"));
    inputs.add(models.field(variant, "selectors"));
    inputs.add(models.field(variant, "codeComponentName"));
    inputs.add(models.field(variant, "codeComponentVariantKeys"));
    if (variant.parent) {
      inputs.add(models.field(variant.parent, "uuid"));
      inputs.add(models.field(variant.parent, "variants"));
      inputs.add(models.field(variant.parent, "multi"));
      inputs.add(models.field(variant.parent, "type"));
      inputs.add(models.field(variant.parent, "param"));
      inputs.add(models.field(variant.parent.param, "variable"));
      inputs.add(models.field(variant.parent.param.variable, "name"));
      variant.parent.variants.forEach((member) => inputs.add(models.field(member, "name")));
    }
  }
  return { inputs, targeted: view.variantTplMgr().getCurrentVariantCombo().some(isStyleOrCodeComponentVariant) };
}

function outlineVariantResource(view: ViewCtx | undefined) {
  const lifetime = view?.disposeSignal;
  let sealed = !!lifetime?.aborted;
  let current = view && !sealed ? readOutlineVariantInputs(view).targeted : undefined;
  const listeners = new Set<() => void>();
  const subscriptions = new Map<OutlineVariantInput, () => void>();
  const disconnect = () => {
    subscriptions.forEach((stop) => stop());
    subscriptions.clear();
    lifetime?.removeEventListener("abort", seal);
  };
  const seal = () => { sealed = true; disconnect(); listeners.clear(); };
  const refresh = () => {
    if (!view || sealed || !listeners.size) { return; }
    if (lifetime?.aborted) { seal(); return; }
    const next = readOutlineVariantInputs(view);
    for (const input of next.inputs) {
      if (!subscriptions.has(input)) { subscriptions.set(input, input.subscribe(refresh)); }
    }
    for (const [input, stop] of subscriptions) {
      if (!next.inputs.has(input)) { stop(); subscriptions.delete(input); }
    }
    if (current !== next.targeted) {
      current = next.targeted;
      listeners.forEach((notify) => notify());
    }
  };
  return {
    getSnapshot: () => current,
    subscribe: (notify: () => void) => {
      if (!view || sealed || lifetime?.aborted) { seal(); return () => undefined; }
      listeners.add(notify);
      lifetime?.addEventListener("abort", seal, { once: true });
      // Commit-time connection also captures changes after the render snapshot.
      refresh();
      return () => { listeners.delete(notify); if (!listeners.size) { disconnect(); } };
    },
  };
}

export function OutlinePanelSection() {
  const { t: uiT } = useI18n();
  const sc = useStyleTarget();

  const studioCtx = sc.studioCtx();
  const viewCtx = useStudioSelection(studioCtx, (state) => state.view);

  const [isOpen, setIsOpen] = React.useState(false);
  const cells = useStyleCells(sc.props.expsProvider, outlineStyleProps);
  const hasOutlineProps = cells.some((cell) => cell.targetHas);
  const isVisible = isOpen || hasOutlineProps;

  // A mixin editor has no focused View owner.
  const variantResource = React.useMemo(() => outlineVariantResource(viewCtx), [viewCtx, studioCtx.modelSnapshots]);
  const isStyleOrCodeComponentVariantTargeted = React.useSyncExternalStore(
    variantResource.subscribe, variantResource.getSnapshot, variantResource.getSnapshot,
  );

  const onClick = async () => {
    if (isVisible) {
      await studioCtx.change(() => {
        outlineStyleProps.forEach((prop) => {
          if (sc.hasTargetProp(prop)) {
            sc.exp().clear(prop);
          }
        });
        return ok();
      });
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <StylePanelSection
      key={String(isVisible)}
      title={uiT("Outline")}
      expsProvider={sc.props.expsProvider}
      styleProps={outlineStyleProps}
      onHeaderClick={!isVisible ? onClick : undefined}
      controls={
        <IconLinkButton onClick={onClick}>
          <Icon icon={isVisible ? MinusIcon : PlusIcon} />
        </IconLinkButton>
      }
    >
      {isVisible && (
        <>
          {isStyleOrCodeComponentVariantTargeted === false && (
            <Alert
              className="mb-lg"
              message={
                <StandardMarkdown>
                  {uiT(
                    "[Outlines](https://developer.mozilla.org/en-US/docs/Web/CSS/outline) are typically used for styling the focused state of an element. We recommend only using this property for focus-related interaction variants.",
                  )}
                </StandardMarkdown>
              }
              type="info"
              showIcon
            />
          )}
          <LabeledStyleDimItemRow
            label={uiT("Width")}
            styleName={[OutlineProps.width]}
            tokenType={"Spacing"}
            dimOpts={{
              extraOptions: [
                { value: "thin", label: uiT("Thin") },
                { value: "medium", label: uiT("Medium") },
                { value: "thick", label: uiT("Thick") },
              ],
              min: 0,
              allowedUnits: LENGTH_PERCENTAGE_UNITS,
              allowFunctions: true,
            }}
          />
          <LabeledLineStyleToggleButtonGroupItemRow
            label={uiT("Style")}
            styleName={[OutlineProps.style]}
          />
          <LabeledStyleColorItemRow
            label={uiT("Color")}
            styleName={[OutlineProps.color]}
            displayStyleName={OutlineProps.color}
          />
          <LabeledStyleDimItemRow
            label={uiT("Offset")}
            styleName={[OutlineProps.offset]}
            tokenType={"Spacing"}
            dimOpts={{
              allowedUnits: LENGTH_PERCENTAGE_UNITS,
              allowFunctions: true,
            }}
          />
        </>
      )}
    </StylePanelSection>
  );
}
