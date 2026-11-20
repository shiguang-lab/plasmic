import { InspectorEdit } from "@/wab/client/components/studio/inspector-access";
import type { SidebarSectionHandle } from "@/wab/client/components/sidebar/SidebarSection";
import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import {
  changeStyle,
  ExpsProvider,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import { StyleEditorPopover } from "@/wab/client/components/style-controls/StyleEditorPopover";
import { TransformPanel } from "@/wab/client/components/style-controls/TransformPanel";
import { TransformSettingsPanel } from "@/wab/client/components/style-controls/TransformSettingsPanel";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import {
  useStyleCells,
  useStyleIndicators,
} from "@/wab/client/studio-ctx/style-inputs-react";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { assert } from "@/wab/shared/common";
import {
  CssTransform,
  CssTransforms,
  defaultCssTransform,
  parseOrigin,
} from "@/wab/shared/css/transforms";
import React, { useRef, useState } from "react";
import { FiSlash } from "react-icons/fi";

export function TransformPanelSection(props: { expsProvider: ExpsProvider }) {
    const { t: uiT } = useI18n();
    const { expsProvider } = props;
    const { studioCtx } = expsProvider;
    const sectionRef = useRef<SidebarSectionHandle>(null);
    const [openEditor, setOpenEditor] = useState<"settings" | number>();
    const changeOpenEditor = (editor: "settings" | number, open: boolean) => {
      setOpenEditor((current) =>
        open ? editor : current === editor ? undefined : current,
      );
    };
    const [
      transformCell,
      transformOriginCell,
      perspectiveOriginCell,
      backfaceVisibilityCell,
      childPerspectiveCell,
    ] = useStyleCells(expsProvider, [
      "transform",
      "transform-origin",
      "perspective-origin",
      "backface-visibility",
      "perspective",
    ]);

    const cssTransforms = CssTransforms.fromCss(transformCell?.raw ?? "");

    const transforms = cssTransforms.transforms;
    const isNone = transformCell?.raw === "none";
    const rows: (CssTransform | null)[] = isNone ? [null] : transforms;

    const rawTransformOrigin = transformOriginCell?.raw;
    const transformOrigin = parseOrigin(rawTransformOrigin);

    const rawPerspectiveOrigin = perspectiveOriginCell?.raw;
    const perspectiveOrigin = parseOrigin(rawPerspectiveOrigin);

    const backfaceVisibility = backfaceVisibilityCell?.raw || "visible";

    const childPerspective = childPerspectiveCell?.raw || "0px";

    const setProp = (prop: string, value: string | undefined) => {
      changeStyle(expsProvider, () => {
        if (!value) {
          expsProvider.maybeTargetExp()?.clear(prop);
        } else {
          expsProvider.mergedExp().set(prop, value);
        }
      });
    };

    const setsProp = (prop: string, value: CssTransforms) => {
      setProp(prop, value.transforms.length || value.perspective ? value.showCss() : undefined);
    };

    const updateTransforms = (newTransforms: CssTransform[]) => {
      setsProp("transform", new CssTransforms(newTransforms, cssTransforms.perspective));
    };

    const updateSelfPerspective = (newSelfPerspective: string | undefined) => {
      setsProp("transform", new CssTransforms(transforms, newSelfPerspective));
    };

    const updateTransformOrigin = (
      origin:
        | {
            left: string;
            top: string;
          }
        | undefined,
    ) => {
      setProp("transform-origin", origin && `${origin.left} ${origin.top}`);
    };

    const updatePerspectiveOrigin = (
      origin:
        | {
            left: string;
            top: string;
          }
        | undefined,
    ) => {
      setProp("perspective-origin", origin && `${origin.left} ${origin.top}`);
    };

    const updateBackfaceVisibility = (visibility: string | undefined) => {
      setProp("backface-visibility", visibility);
    };

    const updateChildPerspective = (
      newChildPerspective: string | undefined,
    ) => {
      setProp("perspective", newChildPerspective);
    };

    const addTransformation = () => {
      const newTransform = CssTransform.fromCss(defaultCssTransform.translate);
      assert(newTransform, "Expected CssTransform, found null");

      updateTransforms([newTransform, ...transforms]);
      setOpenEditor(0);
      sectionRef.current?.expand();
    };

    const styleProps = [
      "transform",
      "transform-origin",
      "backface-visibility",
      "perspective",
      "perspective-origin",
    ];

    const styleIndicators = useStyleIndicators(expsProvider, styleProps).filter(
      (indicator) => indicator.source !== "none",
    );

    const { isDisabled } = shouldBeDisabled({
      props: {},
      indicators: styleIndicators,
    });

    const transformTitle = uiT("Transform");
    const settingsTitle = uiT("Transform Settings");

    return (
      <StylePanelSection
        ref={sectionRef}
        title={transformTitle}
        styleProps={styleProps}
        headerMenuOnRightClickOnly
        controls={
          <>
            <StyleEditorPopover
              title={settingsTitle}
              open={!isDisabled && openEditor === "settings"}
              onOpenChange={(open) => changeOpenEditor("settings", open)}
              content={
                <TransformSettingsPanel
                  selfPerspective={cssTransforms.perspective}
                  studioCtx={studioCtx}
                  transformOrigin={transformOrigin}
                  backfaceVisibility={backfaceVisibility}
                  childPerspective={childPerspective}
                  perspectiveOrigin={perspectiveOrigin}
                  updateSelfPerspective={updateSelfPerspective}
                  updateTransformOrigin={updateTransformOrigin}
                  updateBackfaceVisibility={updateBackfaceVisibility}
                  updateChildPerspective={updateChildPerspective}
                  updatePerspectiveOrigin={updatePerspectiveOrigin}
                />
              }
            >
              <IconButton size="small" tooltip={settingsTitle} disabled={isDisabled}>
                <Icon icon={GearIcon} />
              </IconButton>
            </StyleEditorPopover>
            <InspectorEdit><IconButton
              size="small"
              tooltip={uiT("Add transform")}
              aria-label={uiT("Add transform")}
              disabled={isDisabled}
              onClick={addTransformation}
            >
              <Icon icon={PlusIcon} />
            </IconButton></InspectorEdit>
          </>
        }
        expsProvider={expsProvider}
      >
        {rows.length > 0 && (
          <ListBox
            appendPrepend="append"
            onReorder={(from, to) => {
              if (!isDisabled) {
                setOpenEditor(undefined);
                updateTransforms(arrayMoveIndex(transforms, from, to));
              }
            }}
          >
            {rows.map((cssTransform, i) => {
              const label = cssTransform ? uiT(({
                translate: "Translate", rotate: "Rotate", scale: "Scale", skew: "Skew", perspective: "Self Perspective",
              } as const)[cssTransform.type]) : uiT("None");
              return (
                <ListBoxItem
                  key={i}
                  index={i}
                  clickable={false}
                  truncate={false}
                  disabled={isDisabled}
                  isDragDisabled={isDisabled || transforms.length < 2}
                  removeLabel={uiT(isNone ? "Remove None override" : "Remove")}
                  onRemove={() => {
                    if (isDisabled) { return; }
                    setOpenEditor(undefined);
                    updateTransforms(
                      transforms.filter((_, index) => index !== i),
                    );
                  }}
                  mainContent={
                    <div className={`${paintStyles.fillValue} flex-fill`}>
                      <StyleEditorPopover
                        title={transformTitle}
                        open={!isDisabled && openEditor === i}
                        onOpenChange={(open) => changeOpenEditor(i, open)}
                        content={
                          <TransformPanel
                            transform={cssTransform}
                            onChange={(newTransform) => {
                              if (isDisabled) { return; }
                              if (!newTransform) {
                                setProp("transform", "none");
                                setOpenEditor(0);
                              } else {
                                updateTransforms(isNone ? [newTransform] :
                                  transforms.map((transform, index) => index === i ? newTransform : transform));
                              }
                            }}
                            studioCtx={studioCtx}
                          />
                        }
                      >
                        <button
                          type="button"
                          className={paintStyles.fillEdit}
                          disabled={isDisabled}
                          aria-label={`${transformTitle}: ${label}`}
                        >
                          {isNone && <FiSlash aria-hidden="true" />}
                          <span className={paintStyles.fillLabel}>{label}</span>
                          {cssTransform && <span className={paintStyles.valueSummary}>
                            {cssTransform.getDisplayText()}
                          </span>}
                        </button>
                      </StyleEditorPopover>
                    </div>
                  }
                />
              );
            })}
          </ListBox>
        )}
      </StylePanelSection>
    );
}
