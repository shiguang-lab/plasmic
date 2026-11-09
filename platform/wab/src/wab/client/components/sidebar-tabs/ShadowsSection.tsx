import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import { BoxShadowPanel } from "@/wab/client/components/style-controls/BoxShadowControls";
import { ColorSwatch } from "@/wab/client/components/style-controls/ColorSwatch";
import {
  StyleComponentProps,
  TplExpsProvider,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import {
  IconLinkButton,
  ListBox,
  ListBoxItem,
} from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { derefTokenRefs, extractAllReferencedTokenIds, replaceAllTokenRefs } from "@/wab/commons/StyleToken";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { BoxShadow, BoxShadows, Dim } from "@/wab/shared/core/bg-styles";
import { parseCss } from "@/wab/shared/css";
import { Tooltip } from "antd";
import React from "react";
import { useStyleCell, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useImageAssetList } from "@/wab/client/studio-ctx/image-asset-inputs";
import { extractAllAssetRefs, resolveAllAssetRefs } from "@/wab/shared/core/image-assets";
import { findLast } from "lodash";
import { useShallow } from "zustand/react/shallow";

interface ShadowsPanelSectionState {
  inspectedShadow?: BoxShadow;
  // index of the inspected shadow
  index?: number;
}

export function ShadowsPanelSection(props: StyleComponentProps) {
  const studio = props.expsProvider.studioCtx;
  const lifetime = React.useMemo(() => studio.arenaState.lifetime(), [studio, props.expsProvider]);
  const subscribe = React.useCallback((notify: () => void) => {
    lifetime.addEventListener("abort", notify);
    return () => lifetime.removeEventListener("abort", notify);
  }, [lifetime]);
  const readActive = React.useCallback(() => !lifetime.aborted, [lifetime]);
  const active = React.useSyncExternalStore(subscribe, readActive, readActive);
  return active ? <ShadowsContent {...props} /> : null;
}

function ShadowsContent(props: StyleComponentProps) {
    const { expsProvider } = props;
    const studio = expsProvider.studioCtx;
    const cell = useStyleCell(expsProvider, "box-shadow");
    const indicators = useStyleIndicators(expsProvider, ["box-shadow"]).filter((indicator) => indicator.source !== "none");
    const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studio);
    const vsh = props.vsh ?? currentVsh;
    const [{ inspectedShadow, index }, setState] = React.useState<ShadowsPanelSectionState>({});
    const updateBoxShadows = (shadows: BoxShadows) => {
      studio.changeSpawn(() => {
        if (!(expsProvider instanceof TplExpsProvider) || expsProvider.canEdit()) {
          expsProvider.mergedExp().set("box-shadow", shadows.shadows.length ? shadows.showCss() : "none");
        }
      });
    };
    const inspectBoxShadow = (shadow: BoxShadow, position: number) => setState({ inspectedShadow: shadow, index: position });
    const boxShadows: BoxShadows = (() => {
      const v = cell?.value ?? "none";
      if (v === "none") {
        return new BoxShadows([]);
      } else {
        return parseCss(v, { startRule: "boxShadows" });
      }
    })();
    const addShadowLayer = () => {
      const layer = new BoxShadow({
        inset: false,
        x: new Dim("0", "px"),
        y: new Dim("4", "px"),
        blur: new Dim("16", "px"),
        spread: new Dim("0", "px"),
        color: "rgba(0,0,0,0.2)",
      });

      updateBoxShadows(new BoxShadows([...boxShadows.shadows, layer]));
      inspectBoxShadow(layer, boxShadows.shadows.length);
    };

    const { isDisabled, disabledTooltip } = shouldBeDisabled({
      props: {},
      label: translate(getUiLocale(), "Shadows"),
      indicators: indicators,
    });

    const inputs = boxShadows.shadows.map((shadow) => shadow.color);
    const colors = useStyleTokenRefs(studio, inputs, vsh, "all", useShallow((state) => state.rows.map((row) => row.resolved?.value)));
    const labels = useStyleTokenRefs(studio, inputs, vsh, "ColorLabel", useShallow((state) => state.rows.map((row) => row.applied)));
    const imageAssets = useImageAssetList(studio);
    const raw = boxShadows.shadows.map((shadow) => shadow.showCss());
    const assets = new Map(extractAllAssetRefs(raw.join(" ")).flatMap((id) => {
      const asset = findLast(imageAssets.rows, (candidate) => candidate.uuid === id);
      return asset ? [[id, asset] as const] : [];
    }));
    const assetResolved = raw.map((value) => resolveAllAssetRefs(value, assets));
    const requests = assetResolved.flatMap((value) => extractAllReferencedTokenIds(value).map((id) => `var(--token-${id})`));
    const thumbnails = useStyleTokenRefs(studio, requests, vsh, "dictionary", useShallow((state) => state.rows.map((row) => row.resolved?.value)));

    return (
      <StylePanelSection
        key={String(boxShadows.shadows.length > 0)}
        expsProvider={expsProvider}
        title={<UiText message={"Shadows"} />}
        styleProps={["box-shadow"]}
        onExtraContentExpanded={() => {
          if (boxShadows.shadows.length === 0) {
            addShadowLayer();
          }
        }}
        onHeaderClick={
          boxShadows.shadows.length === 0 ? addShadowLayer : undefined
        }
        controls={
          <MaybeWrap
            cond={!!disabledTooltip && !!isDisabled}
            wrapper={(e) => (
              <Tooltip title={disabledTooltip}>
                <TriggerTarget>{e}</TriggerTarget>
              </Tooltip>
            )}
          >
            <IconLinkButton onClick={addShadowLayer} disabled={isDisabled}>
              <Icon icon={PlusIcon} />
            </IconLinkButton>
          </MaybeWrap>
        }
        defaultHeaderAction={() => !isDisabled && addShadowLayer()}
      >
        {boxShadows.shadows.length > 0 && (
          <>
            <SidebarModal
              show={!!inspectedShadow && !isDisabled}
              onClose={() => setState({ inspectedShadow: undefined })}
              title={translate(getUiLocale(), "Shadow")}
            >
              {inspectedShadow && index !== undefined && (
                <div className="panel-content">
                  <BoxShadowPanel
                    expsProvider={expsProvider}
                    defaultShadow={inspectedShadow}
                    onUpdated={(shadow) => {
                      setState({ inspectedShadow: shadow, index });
                      updateBoxShadows(new BoxShadows(boxShadows.shadows.map((current, position) => position === index ? shadow : current)));
                    }}
                    vsh={vsh}
                  />
                </div>
              )}
            </SidebarModal>
            <StyleWrapper
              styleName={["box-shadow"]}
              className="flex-fill"
              showDefinedIndicator={true}
            >
              <ListBox
                appendPrepend={"append"}
                {...(isDisabled
                  ? {}
                  : {
                      onReorder: (from, to) => {
                        updateBoxShadows(new BoxShadows(arrayMoveIndex(boxShadows.shadows, from, to)));
                      },
                    })}
              >
                {boxShadows.shadows.map((shadow: BoxShadow, i: number) => {
                  const color = colors.selected[i] ?? derefTokenRefs([], shadow.color);
                  const token = labels.selected[i];
                  return (
                    <ListBoxItem
                      key={i}
                      index={i}
                      onRemove={() => {
                        if (!isDisabled) {
                          return updateBoxShadows(new BoxShadows(boxShadows.shadows.filter((candidate) => candidate !== shadow)));
                        }
                      }}
                      onClick={() =>
                        !isDisabled && inspectBoxShadow(shadow, i)
                      }
                      mainContent={
                        <>
                          <ColorSwatch color={color} />
                          <code className="ml-sm text-ellipsis">
                            {token ? token.name : color}
                          </code>
                        </>
                      }
                      thumbnail={
                        <div
                          className="shadow-thumb"
                          style={{
                            boxShadow: replaceAllTokenRefs(assetResolved[i], (id) => thumbnails.selected[requests.indexOf(`var(--token-${id})`)]),
                          }}
                        />
                      }
                      gridThumbnail
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

