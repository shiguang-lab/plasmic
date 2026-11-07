import {
  BackdropFilterEffectSection,
  FilterEffectSection,
} from "@/wab/client/components/sidebar-tabs/FilterEffectSection";
import {
  FullRow,
  LabeledStyleSelectItem,
  LabeledStyleSelectItemRow,
  LabeledStyleSwitchItem,
  SectionSeparator,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  ExpsProvider,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import {
  useStyleCells,
  useStyleIndicators,
} from "@/wab/client/studio-ctx/style-inputs-react";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import L from "lodash";
import React from "react";
import {
  FaHandPaper,
  FaHandPointer,
  FaHandRock,
  FaICursor,
  FaMousePointer,
  FaSpinner,
} from "react-icons/fa";
import { FiMove } from "react-icons/fi";
import { MdDoNotDisturbAlt } from "react-icons/md";

const mixBlendModeOpts = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

const effectsStyleProps = [
  "cursor",
  "pointer-events",
  "mix-blend-mode",
  "isolation",
];

const effectIndicatorProps = [
  ...effectsStyleProps,
  "filter",
  "backdrop-filter",
];

export function EffectsPanelSection(props: {
  expsProvider: ExpsProvider;
  animatableOnly?: boolean;
}) {
    const { t: uiT } = useI18n();
    const { expsProvider, animatableOnly } = props;
    const { studioCtx } = expsProvider;
    const [pointerEventsCell, isolationCell] = useStyleCells(expsProvider, [
      "pointer-events",
      "isolation",
    ]);
    const effectIndicators = useStyleIndicators(
      expsProvider,
      effectIndicatorProps,
    );
    const indicatorByKey = new Map(
      effectIndicatorProps.map((key, index) => [key, effectIndicators[index]]),
    );

    const isSet = (...properties: string[]) =>
      properties.some(
        (prop) => indicatorByKey.get(prop)?.source !== "none",
      );

    return (
      <StylePanelSection
        fullyCollapsible
        expsProvider={expsProvider}
        title={uiT("Effects")}
        styleProps={effectsStyleProps}
        hasMore
      >
        {(renderMaybeCollapsibleRows) => (
          <>
            {!animatableOnly &&
              renderMaybeCollapsibleRows(
                [
                  {
                    collapsible: !isSet("cursor", "pointer-events"),
                    content: (
                      <>
                        <FullRow>
                          <LabeledStyleSelectItem
                            styleName="cursor"
                            label={uiT("Cursor")}
                            tooltip={uiT(
                              "Set mouse cursor when hovering on this layer",
                            )}
                            textRight={false}
                            selectOpts={{
                              options: [
                                {
                                  value: "auto",
                                  label: uiT("Auto"),
                                },
                                {
                                  value: "default",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaMousePointer className="mr-ch" />{" "}
                                      <UiText message={"Default"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "pointer",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaHandPointer className="mr-ch" />{" "}
                                      <UiText message={"Pointer"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "text",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaICursor className="mr-ch" />{" "}
                                      <UiText message={"Text"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "move",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FiMove className="mr-ch" />{" "}
                                      <UiText message={"Move"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "wait",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaSpinner className="mr-ch" />{" "}
                                      <UiText message={"Wait"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "grab",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaHandPaper className="mr-ch" />{" "}
                                      <UiText message={"Grab"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "grabbing",
                                  label: (
                                    <span className="flex-vcenter">
                                      <FaHandRock className="mr-ch" />{" "}
                                      <UiText message={"Grabbing"} />
                                    </span>
                                  ),
                                },
                                {
                                  value: "not-allowed",
                                  label: (
                                    <span className="flex-vcenter">
                                      <MdDoNotDisturbAlt className="mr-ch" />{" "}
                                      <UiText message={"Not allowed"} />
                                    </span>
                                  ),
                                },
                              ],
                            }}
                          />
                        </FullRow>
                        <FullRow>
                          <LabeledStyleSwitchItem
                            styleName="pointer-events"
                            label={uiT("Interactive")}
                            value={pointerEventsCell?.value === "auto"}
                            onChange={(checked) =>
                              studioCtx.changeUnsafe(() =>
                                expsProvider.mergedExp().set(
                                  "pointer-events",
                                  checked ? "auto" : "none",
                                ),
                              )
                            }
                          />
                        </FullRow>
                      </>
                    ),
                  },
                  {
                    collapsible:
                      !isSet("isolation", "mix-blend-mode") ||
                      !isSet("pointer-events", "cursor"),
                    content: <SectionSeparator className="mv-m" />,
                  },
                  {
                    collapsible: !isSet("isolation", "mix-blend-mode"),
                    content: (
                      <>
                        <FullRow>
                          <LabeledStyleSelectItemRow
                            styleName="mix-blend-mode"
                            label={uiT("Blend")}
                            tooltip={uiT(
                              "How should the colors blend with the elements behind it?",
                            )}
                            textRight={false}
                            selectOpts={{
                              options: mixBlendModeOpts.map((value) => ({
                                value: value,
                                label: L.capitalize(value),
                              })),
                            }}
                          />
                        </FullRow>
                        <FullRow>
                          <LabeledStyleSwitchItem
                            styleName="isolation"
                            label={uiT("Reset context")}
                            value={isolationCell?.value === "isolate"}
                            onChange={(checked) =>
                              studioCtx.changeUnsafe(() =>
                                expsProvider.mergedExp().set(
                                  "isolation",
                                  checked ? "isolate" : "auto",
                                ),
                              )
                            }
                            tooltip={uiT(
                              "Prevents children elements with blend modes from blending with parents of this container.",
                            )}
                          />
                        </FullRow>
                      </>
                    ),
                  },
                  {
                    collapsible:
                      !(
                        isSet("isolation", "mix-blend-mode") ||
                        isSet("pointer-events", "cursor") ||
                        isSet("isolation", "mix-blend-mode")
                      ) || !isSet("filter"),
                    content: <SectionSeparator className="mv-m" />,
                  },
                  {
                    collapsible: !isSet("filter"),
                    content: (
                      <FilterEffectSection expsProvider={expsProvider} />
                    ),
                  },
                  {
                    collapsible:
                      !(
                        isSet("isolation", "mix-blend-mode") ||
                        isSet("pointer-events", "cursor") ||
                        isSet("isolation", "mix-blend-mode") ||
                        isSet("filter")
                      ) || !isSet("backdrop-filter"),
                    content: <SectionSeparator className="mv-m" />,
                  },
                  {
                    collapsible: !isSet("backdrop-filter"),
                    content: (
                      <BackdropFilterEffectSection
                        expsProvider={expsProvider}
                      />
                    ),
                  },
                ],
                { alwaysVisible: true },
              )}

            {animatableOnly && (
              <>
                <FilterEffectSection expsProvider={expsProvider} />
                <SectionSeparator className="mv-m" />
                <BackdropFilterEffectSection expsProvider={expsProvider} />
              </>
            )}
          </>
        )}
      </StylePanelSection>
    );
}
