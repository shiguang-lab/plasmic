import { useFocusedViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useBaseTransitionInputs } from "@/wab/client/studio-ctx/transition-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { NonBaseVariantTransitionsMessage } from "@/wab/client/components/sidebar-tabs/style-tab";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { SidebarSectionHandle } from "@/wab/client/components/sidebar/SidebarSection";
import {
  createStyleTarget,
  StyleComponentProps,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { TransitionPanel } from "@/wab/client/components/style-controls/transition-panel";
import {
  IconLinkButton,
  ListBox,
  ListBoxItem,
} from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { arrayMoveIndex, arrayRemove } from "@/wab/shared/collections";
import { assert, ensure, maybe, tuple, uniqueKey } from "@/wab/shared/common";
import { transitionProps } from "@/wab/shared/core/style-props";
import { getCssInitial } from "@/wab/shared/css";
import { joinCssValues, splitCssValue } from "@/wab/shared/css/parse";
import React from "react";

export class Transition {
  transitionProperty: string;
  transitionTimingFunction: string;
  transitionDuration: string;
  transitionDelay: string;
}

export function TransitionsPanelSection(props: StyleComponentProps) {
  const { expsProvider } = props;
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

    const transitions = ((): Transition[] => {
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
      const newTransition: Transition = {
        transitionProperty: "all",
        transitionTimingFunction: "ease",
        transitionDuration: "1s",
        transitionDelay: "0s",
      };
      updateTransitions([...transitions, newTransition]);
      setIndex(transitions.length);

      sectionRef.current?.expand();
    };

    return (
      <StylePanelSection
        key={String(transitions.length > 0)}
        ref={sectionRef}
        expsProvider={expsProvider}
        title={<UiText message={"Transitions"} />}
        styleProps={transitionProps}
        onHeaderClick={transitions.length === 0 ? addTransition : undefined}
        controls={
          <IconLinkButton onClick={addTransition}>
            <Icon icon={PlusIcon} />
          </IconLinkButton>
        }
        defaultHeaderAction={addTransition}
      >
        {transitions.length > 0 && (
          <>
            {isTargetingNonBaseVariant && (
              <div className="canvas-editor__right-float-pane">
                <NonBaseVariantTransitionsMessage />
              </div>
            )}
            {inspectedIndex !== undefined && (
              <SidebarModal
                show
                title={translate(getUiLocale(), "Transition")}
                onClose={() => setIndex(undefined)}
              >
                {
                  <div className="panel-content">
                    <TransitionPanel
                      transition={transitions[inspectedIndex]}
                      onChange={(newValue: Transition) => {
                        updateTransitions(transitions.map((transition, index) => index === inspectedIndex ? newValue : transition));
                      }}
                    />
                  </div>
                }
              </SidebarModal>
            )}
            <StyleWrapper
              styleName={transitionProps}
              displayStyleName="transition"
              className="flex-fill"
              showDefinedIndicator={true}
            >
              <ListBox
                appendPrepend={"append"}
                onReorder={(from, to) => {
                  const moved = arrayMoveIndex(transitions, from, to);
                  updateTransitions(moved);
                }}
              >
                {transitions.map((transition: Transition, i: number) => {
                  return (
                    <ListBoxItem
                      key={uniqueKey(transition)}
                      index={i}
                      onRemove={() => {
                        arrayRemove(transitions, transition);
                        return updateTransitions(transitions);
                      }}
                      onClick={() => setIndex(i)}
                      mainContent={
                        <div className="labeled-item labeled-item--horizontal--vcenter">
                          <div className="labeled-item__label labeled-item__label--horizontal">
                            <UiText message={"Property"} />
                          </div>
                          <code>{transition.transitionProperty}</code>
                        </div>
                      }
                    />
                  );
                })}
              </ListBox>
            </StyleWrapper>
          </>
        )}
      </StylePanelSection>
    );
}
