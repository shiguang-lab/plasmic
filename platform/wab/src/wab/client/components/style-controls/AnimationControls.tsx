import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import {
  FullRow,
  LabeledItem,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleSelect from "@/wab/client/components/style-controls/StyleSelect";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import TriangleBottomIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__TriangleBottom";
import { useUndo } from "@/wab/client/shortcuts/studio/useUndo";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { cx, ensure, spawn } from "@/wab/shared/common";
import {
  AnimationDirectionKeyword,
  FillModeKeyword,
  animationDirectionKeywords,
  fillModeKeywords,
  timingFunctionKeywords,
} from "@/wab/shared/css/animations";
import { NUMBER_UNITS } from "@/wab/shared/css/types";
import { Animation } from "@/wab/shared/model/classes";
import { Select } from "antd";
import { ok } from "neverthrow";
import React from "react";
import { useAnimationControlInputs } from "@/wab/client/studio-ctx/animation-control-inputs";

interface AnimationControlsProps {
  studioCtx: StudioCtx;
  animation: Animation;
  vsh: VariantedStylesHelper;
  onUpdated: () => void;
}

export function AnimationControls(
  props: AnimationControlsProps,
) {
  const { t: uiT } = useI18n();
  const { animation, studioCtx, onUpdated } = props;
  const inputs = useAnimationControlInputs(studioCtx, animation);
  const state = inputs.snapshot;

  const handleChange = (f: () => void) => {
    spawn(
      studioCtx.change(() => {
        f();
        return ok();
      }),
    );

    onUpdated?.();
  };

  const searchUndo = useUndo("");

  if (!state?.active) { return null; }

  return (
    <>
      <SidebarSection
        title={uiT("Animation")}
        zeroBodyPadding
        zeroHeaderPadding
      >
        <FullRow className="labeled-item">
          <Select
            className={cx({
              "flex-fill textboxlike": true,
            })}
            value={state.sequenceId}
            onChange={(val) => {
              const sequence = inputs.sequence(val);
              if (sequence) {
                handleChange(() => {
                  animation.sequence = sequence;
                });
              }
              searchUndo.reset();
            }}
            showSearch
            searchValue={searchUndo.value}
            onSearch={searchUndo.push}
            onInputKeyDown={searchUndo.handleKeyDown}
            onFocus={() => {
              searchUndo.reset();
            }}
            filterOption={(val, opt) => {
              if (!opt) {
                return false;
              }
              if ("searchText" in opt && typeof opt.searchText === "string") {
                return opt.searchText.toLowerCase().includes(val.toLowerCase());
              }
              return false;
            }}
            suffixIcon={<Icon icon={TriangleBottomIcon} />}
            optionLabelProp="label"
            options={state.groups.map(
              ({ name, sequences }) => ({
                label: name,
                options: sequences.map((seq) => ({
                  label: seq.name,
                  value: seq.uuid,
                  searchText: seq.name,
                })),
              }),
            )}
          />
        </FullRow>
      </SidebarSection>

      <SidebarSection title={uiT("Timing")} zeroBodyPadding zeroHeaderPadding>
        <FullRow>
          <LabeledItem label={uiT("Duration")}>
            <DimTokenSpinner
              value={state.duration}
              onChange={(val) =>
                handleChange(() => (animation.duration = val || "1s"))
              }
              noClear
              allowedUnits={["s", "ms"]}
              allowFunctions
              extraOptions={[]}
              studioCtx={studioCtx}
            />
          </LabeledItem>
        </FullRow>
        <FullRow>
          <LabeledItem label={uiT("Delay")}>
            <DimTokenSpinner
              value={state.delay || "0s"}
              onChange={(val) =>
                handleChange(() => (animation.delay = val || "0s"))
              }
              allowedUnits={["s", "ms"]}
              allowFunctions
              extraOptions={[]}
              studioCtx={studioCtx}
            />
          </LabeledItem>
        </FullRow>
      </SidebarSection>

      <SidebarSection
        title={uiT("Easing & Repetition")}
        zeroBodyPadding
        zeroHeaderPadding
      >
        <FullRow>
          <LabeledItem label={uiT("Easing")}>
            <StyleSelect
              value={state.timingFunction || "ease"}
              onChange={(val) =>
                handleChange(() => (animation.timingFunction = val || "ease"))
              }
              valueSetState={state.timingFunction ? "isSet" : "isUnset"}
            >
              {timingFunctionKeywords.map((timingFunction) => (
                <StyleSelect.Option value={timingFunction}>
                  {timingFunction}
                </StyleSelect.Option>
              ))}
            </StyleSelect>
          </LabeledItem>
        </FullRow>

        <FullRow>
          <LabeledItem label={uiT("Iteration Count")}>
            <DimTokenSpinner
              min={0}
              value={state.iterationCount || "1"}
              onChange={(val) =>
                handleChange(() => (animation.iterationCount = val || "1"))
              }
              allowedUnits={NUMBER_UNITS}
              extraOptions={["infinite"]}
              studioCtx={studioCtx}
              allowFunctions={false}
            />
          </LabeledItem>
        </FullRow>

        <FullRow>
          <LabeledItem label={uiT("Direction")}>
            <StyleSelect
              value={state.direction}
              onChange={(val) =>
                handleChange(
                  () =>
                    (animation.direction = ensure(
                      val as AnimationDirectionKeyword,
                      "Unexpected direction value",
                    )),
                )
              }
              valueSetState="isSet"
            >
              {animationDirectionKeywords.map((direction) => (
                <StyleSelect.Option value={direction}>
                  {direction}
                </StyleSelect.Option>
              ))}
            </StyleSelect>
          </LabeledItem>
        </FullRow>
      </SidebarSection>

      <SidebarSection
        title={uiT("Fill Mode")}
        zeroBodyPadding
        zeroHeaderPadding
      >
        <FullRow>
          <StyleSelect
            value={state.fillMode || "none"}
            onChange={(val) =>
              handleChange(
                () =>
                  (animation.fillMode = ensure(
                    val as FillModeKeyword,
                    "Unexpected fillMode value",
                  )),
              )
            }
            valueSetState={state.fillMode ? "isSet" : "isUnset"}
          >
            {fillModeKeywords.map((fillMode) => (
              <StyleSelect.Option value={fillMode}>
                {fillMode}
              </StyleSelect.Option>
            ))}
          </StyleSelect>
        </FullRow>
      </SidebarSection>
    </>
  );
}
