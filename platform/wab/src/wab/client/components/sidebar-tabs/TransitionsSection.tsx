import { useFocusedViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useBaseTransitionInputs } from "@/wab/client/studio-ctx/transition-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { NonBaseVariantTransitionsMessage } from "@/wab/client/components/sidebar-tabs/style-tab";
import { SidebarSectionHandle } from "@/wab/client/components/sidebar/SidebarSection";
import {
  createStyleTarget,
  StyleComponentProps,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { TransitionPanel } from "@/wab/client/components/style-controls/transition-panel";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { assert, ensure, maybe, tuple } from "@/wab/shared/common";
import { transitionProps } from "@/wab/shared/core/style-props";
import { getCssInitial } from "@/wab/shared/css";
import { joinCssValues, splitCssValue } from "@/wab/shared/css/parse";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Popover } from "antd";
import React from "react";
import { FiSlash } from "react-icons/fi";

export class Transition {
  transitionProperty: string;
  transitionTimingFunction: string;
  transitionDuration: string;
  transitionDelay: string;
}

const defaultTransition: Transition = {
  transitionProperty: "all",
  transitionTimingFunction: "ease",
  transitionDuration: "1s",
  transitionDelay: "0s",
};

export function TransitionsPanelSection(props: StyleComponentProps) {
  const { expsProvider } = props;
  const { t: uiT } = useI18n();
  const studio = expsProvider.studioCtx;
  const styling = createStyleTarget(props);
  const [inspectedIndex, setIndex] = React.useState<number>();
  const sectionRef = React.useRef<SidebarSectionHandle>(null);
  const baseRaw = useBaseTransitionInputs(expsProvider instanceof TplExpsProvider ? expsProvider : undefined);
  const singleCells = useStyleCells(expsProvider, expsProvider instanceof TplExpsProvider ? [] : transitionProps);
  const targeting = useFocusedViewVariants(studio, (state) => state.isTargetingNonBaseVariant);
  const isTargetingNonBaseVariant = expsProvider instanceof TplExpsProvider && targeting;
  const rawValues = expsProvider instanceof TplExpsProvider ? baseRaw : transitionProps.map((prop) => singleCells.find((cell) => cell.key === prop)?.raw);

  const baseExp = () => expsProvider instanceof TplExpsProvider
    ? RSH(ensure(tryGetBaseVariantSetting(expsProvider.tpl), "Unexpected undefined base variant for tpl").rs, expsProvider.tpl)
    : expsProvider.mergedExp();

  const updateTransitions = (transitions: Transition[]) => {
    return styling.change(() => {
      const exp = baseExp();
      if (transitions.some((transition) => transition.transitionProperty === "none")) {
        transitionProps.forEach((prop) => exp.clear(prop));
        exp.set("transition-property", "none");
        return;
      }
      const updateRule = (key: string, values: string[]) => {
        // "transition-property" should be always set when transitions are used,
        // so we avoid deleting them. Other properties might be omitted if they
        // use the default value only.
        if (
          values.some((value) => value !== getCssInitial(key, undefined)) ||
          (values.length > 0 && key === "transition-property")
        ) {
          exp.set(key, joinCssValues(key, values));
        } else {
          exp.clear(key);
        }
      };
      updateRule(
        "transition-property",
        transitions.map((v) => v.transitionProperty),
      );
      updateRule(
        "transition-timing-function",
        transitions.map((v) => v.transitionTimingFunction),
      );
      updateRule(
        "transition-duration",
        transitions.map((v) => v.transitionDuration),
      );
      updateRule(
        "transition-delay",
        transitions.map((v) => v.transitionDelay),
      );
    });
  };

    const isNone = rawValues[transitionProps.indexOf("transition-property")] === "none";
    const transitions = ((): Transition[] => {
      if (isNone) { return [{ ...defaultTransition, transitionProperty: "none" }]; }
      const parsedRules = Object.fromEntries(
        transitionProps.map((prop, i) => tuple(prop, maybe(rawValues[i], (val) => splitCssValue(prop, val)) ?? [])),
      );
      const parsedRulesArray = Object.values(parsedRules);
      const numLayers = ensure(
        Math.max(...parsedRulesArray.map((rule) => rule?.length ?? 0)),
        "Unexpected undefined number of layers",
      );
      assert(
        parsedRulesArray.every(
          (rule) => rule?.length === numLayers || rule?.length === 0,
        ),
        "Every parsed rule should have the same length or be empty",
      );
      const getRule = (prop: string, index: number) =>
        parsedRules[prop]?.[index] || getCssInitial(prop, undefined);

      return Array.from({ length: numLayers }).map((_, index) => ({
        transitionProperty: getRule("transition-property", index),
        transitionTimingFunction: getRule("transition-timing-function", index),
        transitionDuration: getRule("transition-duration", index),
        transitionDelay: getRule("transition-delay", index),
      }));
    })();

    const addTransition = () => {
      const newTransition = { ...defaultTransition };
      updateTransitions(isNone ? [newTransition] : [...transitions, newTransition]);
      setIndex(isNone ? 0 : transitions.length);

      sectionRef.current?.expand();
    };

    return (
      <StylePanelSection
        key={String(transitions.length > 0)}
        ref={sectionRef}
        expsProvider={expsProvider}
        title={<UiText message={"Transitions"} />}
        styleProps={transitionProps}
        headerMenuOnRightClickOnly
        controls={
          <IconButton size="small" tooltip={uiT("Add transition")} onClick={addTransition}>
            <Icon icon={PlusIcon} />
          </IconButton>
        }
      >
        {transitions.length > 0 && (
          <>
            {isTargetingNonBaseVariant && (
              <div className="canvas-editor__right-float-pane">
                <NonBaseVariantTransitionsMessage />
              </div>
            )}
            <StyleWrapper
              styleName={transitionProps}
              displayStyleName="transition"
              className="flex-fill"
              showDefinedIndicator={false}
            >
              <ListBox
                appendPrepend={"append"}
                onReorder={(from, to) => {
                  const moved = arrayMoveIndex(transitions, from, to);
                  setIndex((current) => {
                    if (current === undefined) {
                      return undefined;
                    }
                    if (current === from) {
                      return to;
                    }
                    if (from < current && current <= to) {
                      return current - 1;
                    }
                    if (to <= current && current < from) {
                      return current + 1;
                    }
                    return current;
                  });
                  updateTransitions(moved);
                }}
              >
                {transitions.map((transition: Transition, i: number) => (
                  <ListBoxItem
                    key={i}
                    index={i}
                    className={paintStyles.fillItem}
                    isDragDisabled={transitions.length < 2}
                    removeLabel={uiT(isNone ? "Remove None override" : "Remove transition")}
                    onRemove={() => {
                      setIndex((current) => {
                        if (current === undefined || current === i) {
                          return undefined;
                        }
                        return current > i ? current - 1 : current;
                      });
                      return updateTransitions(
                        transitions.filter((_, idx) => idx !== i),
                      );
                    }}
                    clickable={false}
                    truncate={false}
                    mainContent={
                      <TransitionRow
                        transition={transition}
                        open={inspectedIndex === i}
                        onOpenChange={(nextOpen) => {
                          setIndex((current) =>
                            nextOpen ? i : current === i ? undefined : current,
                          );
                        }}
                        onChange={(newValue: Transition) => {
                          if (newValue.transitionProperty === "none") {
                            updateTransitions([newValue]);
                            setIndex(0);
                            return;
                          }
                          updateTransitions(
                            transitions.map((current, index) =>
                              index === i ? newValue : current,
                            ),
                          );
                        }}
                      />
                    }
                  />
                ))}
              </ListBox>
            </StyleWrapper>
          </>
        )}
      </StylePanelSection>
    );
}

function formatTransitionSummary(transition: Transition) {
  const hasDelay =
    transition.transitionDelay !== "0s" && transition.transitionDelay !== "0ms";
  return hasDelay
    ? `${transition.transitionDuration} + ${transition.transitionDelay} · ${transition.transitionTimingFunction}`
    : `${transition.transitionDuration} · ${transition.transitionTimingFunction}`;
}

function TransitionRow({
  transition,
  open,
  onOpenChange,
  onChange,
}: {
  transition: Transition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (newValue: Transition) => void;
}) {
  const { t: uiT } = useI18n();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const title = uiT("Transition");
  const isNone = transition.transitionProperty === "none";
  const label = isNone ? uiT("None") : transition.transitionProperty;
  useStudioEscape(popupRef, open, () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  });

  return (
    <div className={paintStyles.fillValue}>
      <Popover
        trigger="click"
        placement="leftTop"
        title={title}
        open={open}
        destroyOnHidden
        onOpenChange={(nextOpen) => {
          // Keep the popup open while interacting with a child StyleSelect menu
          // portaled to document.body.
          if (!nextOpen && document.querySelector('[data-plasmic-role="overlay"]')) {
            return;
          }
          onOpenChange(nextOpen);
        }}
        content={
          open && (
            <div
              ref={popupRef}
              className={paintStyles.fillPopover}
              role="dialog"
              aria-label={title}
            >
              <Scrollbar scrollX={false} className={paintStyles.fillPopoverBody}>
                <TransitionPanel key={String(isNone)} transition={transition} onChange={onChange} />
              </Scrollbar>
            </div>
          )
        }
      >
        <button
          ref={triggerRef}
          type="button"
          className={paintStyles.fillEdit}
          aria-label={`${title}: ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {isNone && <FiSlash aria-hidden="true" />}
          <span className={paintStyles.fillLabel}>
            {label}
          </span>
          {!isNone && <span className={paintStyles.valueSummary}>
            {formatTransitionSummary(transition)}
          </span>}
        </button>
      </Popover>
    </div>
  );
}
