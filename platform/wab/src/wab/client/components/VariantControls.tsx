import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";

import {
  getVariantIdentifier,
  Selector,
  SelectorsInput,
  SelectorTags,
  styleOrCodeComponentVariantToSelectors,
} from "@/wab/client/components/sidebar/RuleSetControls";
import S from "@/wab/client/components/VariantControls.module.scss";
import Button from "@/wab/client/components/widgets/Button";
import {
  EditableLabel,
  EditableLabelHandles,
} from "@/wab/client/components/widgets/EditableLabel";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { InlineEdit } from "@/wab/commons/components/InlineEdit";
import { spawn } from "@/wab/shared/common";
import { isTplCodeComponent, isTplTag } from "@/wab/shared/core/tpls";
import { VARIANT_CAP, VARIANT_LOWER } from "@/wab/shared/Labels";
import { Component, isKnownTplTag, Variant } from "@/wab/shared/model/classes";
import {
  isBaseVariant,
  isCodeComponentVariant,
  isGlobalVariant,
  isPrivateStyleVariant,
  isStyleOrCodeComponentVariant,
  makeVariantName,
  StyleOrCodeComponentVariant,
  toVariantKey,
} from "@/wab/shared/Variants";
import { Menu } from "antd";
import { default as classNames, default as cn } from "classnames";
import { sumBy } from "lodash";
import { ok } from "neverthrow";
import React, {
  forwardRef,
  ForwardRefRenderFunction,
  useEffect,
  useState,
} from "react";

type VariantLabelProps = {
  variant: Variant;
  superComp?: Component;
  isRecording?: boolean;
  programmaticallyTriggered?: boolean;
  className?: string;
  inputBoxClassName?: string;
  onRenamed?: (name: string) => void;
  defaultEditing?: boolean;
  doubleClickToEdit?: boolean;
  useGroupNameForSplits?: boolean;
};
const VariantLabel_: ForwardRefRenderFunction<
  EditableLabelHandles,
  VariantLabelProps
> = (
  {
    variant,
    superComp,
    onRenamed,
    className,
    inputBoxClassName,
    defaultEditing,
    doubleClickToEdit,
    isRecording,
    programmaticallyTriggered,
    useGroupNameForSplits,
  }: VariantLabelProps,
  ref: React.Ref<EditableLabelHandles>,
) => {
  const { t: studioUiT } = useI18n();

  const studioCtx = useStudioCtx();
  useStudioSelection(studioCtx, (state) => state.view);
  const viewCtx = studioCtx.focusedViewCtx()!;
  useViewSelection(viewCtx, (state) => state.tpls);
  const focusedTpl = viewCtx?.focusedTpl();
  const labels = useVariantLabelInputs(studioCtx, variant, { superComp, focusedTag: isTplTag(focusedTpl) ? focusedTpl : undefined, splitGroup: useGroupNameForSplits });
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, variant]);

  const variantName = labels.entries[0]?.name ?? "";

  const _onRename = (newName: string) => {
    spawn(
      studioCtx.changeUnsafe(() => {
        if (!world.isCurrent()) { return; }
        studioCtx.siteOps().tryRenameVariant(variant, newName);
        onRenamed?.(newName);
      }),
    );
  };

  return (
    <EditableLabel
      ref={ref}
      value={variantName}
      disabled={
        isBaseVariant(variant) || isStyleOrCodeComponentVariant(variant)
      }
      onEdit={_onRename}
      defaultEditing={defaultEditing}
      programmaticallyTriggered={programmaticallyTriggered}
      doubleClickToEdit={doubleClickToEdit}
      inputBoxClassName={cn(
        S.variantLabelInput,
        {
          [S.variantLabelInput__recording]: isRecording,
        },
        inputBoxClassName,
      )}
      inputBoxPlaceholder={studioUiT("{part1} name", {
        part1: translateUiLabel(getUiLocale(), VARIANT_CAP),
      })}
    >
      <span className={className}>{variantName}</span>
    </EditableLabel>
  );
};

const VariantLabelContent = React.memo(forwardRef(VariantLabel_));
export const VariantLabel = React.memo(forwardRef<EditableLabelHandles, VariantLabelProps>(function VariantLabel(props, ref) {
  const studio = useStudioCtx();
  const world = useVariantModelWorld(studio, props.variant);
  return world.alive ? <VariantLabelContent {...props} ref={ref} /> : null;
}));

export function makeCanvasVariantContextMenu({
  studioCtx,
  variant,
  onRequestEditing,
  component,
}: {
  studioCtx: StudioCtx;
  variant: Variant;
  onRequestEditing: () => void;
  component: Component;
}) {
  return (
    <Menu>
      <Menu.Item onClick={onRequestEditing}>
        {isStyleOrCodeComponentVariant(variant)
          ? translate(getUiLocale(), "Change {part1} selectors", {
              part1: translateUiLabel(getUiLocale(), VARIANT_LOWER),
            })
          : translate(getUiLocale(), "Rename {part1}", {
              part1: translateUiLabel(getUiLocale(), VARIANT_LOWER),
            })}
      </Menu.Item>
      <Menu.Item
        onClick={() =>
          studioCtx.changeUnsafe(() => {
            if (isGlobalVariant(variant)) {
              spawn(studioCtx.siteOps().removeGlobalVariant(variant));
            } else {
              spawn(studioCtx.siteOps().removeVariant(component, variant));
            }
          })
        }
      >
        <UiText message={"Delete"} /> {<UiLabel text={VARIANT_LOWER} />}
      </Menu.Item>
    </Menu>
  );
}

const StyleVariantEditorContent = React.memo(function StyleVariantEditor_({
  component,
  onDismiss,
  variant,
}: {
  variant: StyleOrCodeComponentVariant;
  component: Component;
  onDismiss?: () => void;
}) {
  const [chosenSelectors, setChosenSelectors] = useState<Selector[]>([]);
  const studioCtx = useStudioCtx();
  const labels = useVariantLabelInputs(studioCtx, variant, { component });
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, variant]);

  const maybeSubmit = async (opts?: { force?: boolean }) => {
    if (!world.isCurrent()) { return; }
    if (chosenSelectors.length || opts?.force) {
      return studioCtx.changeUnsafe(() => {
        if (!world.isCurrent()) { return; }
        if (isCodeComponentVariant(variant)) {
          variant.codeComponentVariantKeys =
            chosenSelectors.map(getVariantIdentifier);
        } else {
          variant.selectors = chosenSelectors.map(getVariantIdentifier);
        }

        onDismiss?.();

        studioCtx
          .siteOps()
          .removeStyleOrCodeComponentVariantIfDuplicateOrEmpty(
            component,
            variant,
          );
      });
    }
  };

  const submitLatest = React.useEffectEvent(maybeSubmit);

  useEffect(
    () => () => {
      spawn(submitLatest({ force: true }));
    },
    [],
  );

  const incomingSelectors = labels.entries[0]?.selectors ?? [];
  const selectorKey = JSON.stringify(incomingSelectors.map((selector) => selector.type === "CssSelector" ? selector.cssSelector : [selector.componentUuid, selector.componentName, selector.key, selector.displayName]));
  useEffect(() => {
    setChosenSelectors(incomingSelectors);
  }, [toVariantKey(variant), selectorKey]);

  const tplRoot = component.tplTree;

  return (
    <div
      style={{
        minWidth: Math.max(230, sumBy(chosenSelectors, "length") * 7 + 100),
      }}
      className={S.styleVariantEditor}
      onClick={(e) => e.stopPropagation()}
    >
      <SelectorsInput
        autoFocus={true}
        selectors={chosenSelectors}
        onChange={(sels) => setChosenSelectors(sels)}
        forPrivateStyleVariant={false}
        forTag={isKnownTplTag(tplRoot) ? tplRoot.tag : "div"}
        className="textbox--listitem focused-input-bg"
        focusedClassName="focused"
        forRoot={true}
        codeComponent={
          isTplCodeComponent(tplRoot) ? tplRoot.component : undefined
        }
      />
      <Button
        data-test-id="variant-selector-button"
        type={"primary"}
        disabled={chosenSelectors.length === 0}
        onClick={async (e) => {
          e.preventDefault();
          return maybeSubmit();
        }}
      >
        <UiText message={"Done"} />
      </Button>
    </div>
  );
});

export const StyleVariantEditor = React.memo(function StyleVariantEditor(props: React.ComponentProps<typeof StyleVariantEditorContent>) {
  const studio = useStudioCtx();
  const world = useVariantModelWorld(studio, props.variant);
  return world.alive ? <StyleVariantEditorContent {...props} /> : null;
});
const StyleOrCodeComponentVariantLabelContent = React.memo(forwardRef(StyleOrCodeComponentVariantLabel_));
export const StyleOrCodeComponentVariantLabel = React.memo(forwardRef<EditableLabelHandles, React.ComponentProps<typeof StyleOrCodeComponentVariantLabelContent>>(function StyleOrCodeComponentVariantLabel(props, ref) {
  const studio = useStudioCtx();
  const world = useVariantModelWorld(studio, props.variant);
  return world.alive ? <StyleOrCodeComponentVariantLabelContent {...props} ref={ref} /> : null;
}));
function StyleOrCodeComponentVariantLabel_(
  props: {
    defaultEditing?: boolean;
    variant: StyleOrCodeComponentVariant;
    forTag: string;
    onSelectorsChange?: (selectors: Selector[]) => void;
    onBlur?: () => void;
    forRoot?: boolean;
    component: Component;
  },
  ref: React.Ref<EditableLabelHandles>,
) {
  const studioCtx = useStudioCtx();
  const { defaultEditing, variant, forTag, forRoot, component } = props;
  const labels = useVariantLabelInputs(studioCtx, variant, { component });
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, variant]);
  const [chosenSelectors, setChosenSelectors] = useState<Selector[]>([]);

  const tplRoot = component.tplTree;
  const isPrivate = labels.entries[0]?.isPrivate ?? false;

  const incomingSelectors = labels.entries[0]?.selectors ?? [];
  const selectorKey = JSON.stringify(incomingSelectors.map((selector) => selector.type === "CssSelector" ? selector.cssSelector : [selector.componentUuid, selector.componentName, selector.key, selector.displayName]));
  useEffect(() => {
    setChosenSelectors(incomingSelectors);
  }, [toVariantKey(variant), selectorKey]);

  return (
    <div
      className={classNames({
        "flex-fill": true,
      })}
    >
      <InlineEdit
        defaultEditing={defaultEditing}
        ref={ref}
        render={({ editing, onStart, onDone }) =>
          !editing ? (
            <div onDoubleClick={onStart}>
              <SelectorTags
                isCodeComponent={labels.entries[0]?.rootIsCode ?? false}
                selectors={chosenSelectors}
              />
            </div>
          ) : (
            <SelectorsInput
              autoFocus={true}
              selectors={chosenSelectors}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => {
                if (!world.isCurrent()) { return; }
                spawn(
                  studioCtx.change(() => {
                    if (!world.isCurrent()) { return ok(); }
                    if (isCodeComponentVariant(variant)) {
                      variant.codeComponentVariantKeys =
                        chosenSelectors.map(getVariantIdentifier);
                    } else {
                      variant.selectors =
                        chosenSelectors.map(getVariantIdentifier);
                    }

                    studioCtx
                      .siteOps()
                      .removeStyleOrCodeComponentVariantIfDuplicateOrEmpty(
                        component,
                        variant,
                      );
                    return ok();
                  }),
                );

                props.onBlur && props.onBlur();
                onDone();
              }}
              onChange={(sels) => {
                setChosenSelectors(sels);
                props?.onSelectorsChange?.(sels);
              }}
              forPrivateStyleVariant={isPrivate}
              forTag={forTag}
              className="textbox--listitem focused-input-bg"
              focusedClassName="focused"
              forRoot={forRoot}
              codeComponent={
                isTplCodeComponent(tplRoot) ? tplRoot.component : undefined
              }
            />
          )
        }
      />
    </div>
  );
}
