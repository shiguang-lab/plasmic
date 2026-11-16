import type { SidebarSectionHandle } from "@/wab/client/components/sidebar/SidebarSection";
import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import { BoxShadowPanel, createDefaultBoxShadow } from "@/wab/client/components/style-controls/BoxShadowControls";
import shadowStyles from "@/wab/client/components/style-controls/BoxShadowControls.module.scss";
import { ShadowKindIcon } from "@/wab/client/components/style-controls/ShadowKindIcon";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import {
  StyleComponentProps,
  changeStyle,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import { StyleEditorPopover } from "@/wab/client/components/style-controls/StyleEditorPopover";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { derefTokenRefs, extractAllReferencedTokenIds, replaceAllTokenRefs } from "@/wab/commons/StyleToken";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { cx } from "@/wab/shared/common";
import { BoxShadow, BoxShadows } from "@/wab/shared/core/bg-styles";
import { parseCss } from "@/wab/shared/css";
import React from "react";
import { useStyleCell, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useImageAssetList } from "@/wab/client/studio-ctx/image-asset-inputs";
import { extractAllAssetRefs, resolveAllAssetRefs } from "@/wab/shared/core/image-assets";
import { findLast } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { FiSlash } from "react-icons/fi";

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
    const { t } = useI18n();
    const { expsProvider } = props;
    const studio = expsProvider.studioCtx;
    const cell = useStyleCell(expsProvider, "box-shadow");
    const indicators = useStyleIndicators(expsProvider, ["box-shadow"]).filter((indicator) => indicator.source !== "none");
    const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studio);
    const vsh = props.vsh ?? currentVsh;
    const sectionRef = React.useRef<SidebarSectionHandle>(null);
    const [inspectedIndex, setInspectedIndex] = React.useState<number>();
    const updateBoxShadows = (shadows: BoxShadows | null) => {
      changeStyle(expsProvider, () => {
        if (shadows === null) {
          expsProvider.mergedExp().set("box-shadow", "none");
        } else if (shadows.shadows.length > 0) {
          expsProvider.mergedExp().set("box-shadow", shadows.showCss());
        } else {
          expsProvider.maybeTargetExp()?.clear("box-shadow");
        }
      });
    };
    const boxShadows: BoxShadows = (() => {
      const v = cell?.value ?? "none";
      if (v === "none") {
        return new BoxShadows([]);
      } else {
        return parseCss(v, { startRule: "boxShadows" });
      }
    })();
    const none = cell?.raw === "none";
    const rows: (BoxShadow | null)[] = none ? [null] : boxShadows.shadows;
    const { isDisabled, disabledTooltip } = shouldBeDisabled({
      props: {},
      label: t("Shadows"),
      indicators,
      studioCtx: studio,
    });

    const addShadowLayer = () => {
      if (isDisabled) { return; }
      const layer = createDefaultBoxShadow();

      updateBoxShadows(new BoxShadows([...boxShadows.shadows, layer]));
      setInspectedIndex(boxShadows.shadows.length);
      sectionRef.current?.expand();
    };

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

    const title = t("Shadow");
    const addLabel = t("Add shadow");
    const addTooltip = isDisabled
      ? typeof disabledTooltip === "function"
        ? disabledTooltip()
        : disabledTooltip
      : addLabel;

    return (
      <StylePanelSection
        ref={sectionRef}
        expsProvider={expsProvider}
        title={t("Shadows")}
        styleProps={["box-shadow"]}
        headerMenuOnRightClickOnly
        controls={
          <IconButton
            size="small"
            tooltip={addTooltip ?? addLabel}
            aria-label={addLabel}
            onClick={addShadowLayer}
            disabled={isDisabled}
          >
            <Icon icon={PlusIcon} />
          </IconButton>
        }
      >
        {rows.length > 0 && (
          <StyleWrapper styleName="box-shadow" className="flex-fill">
            <ListBox
              onReorder={(from, to) => {
                if (isDisabled || none) { return; }
                setInspectedIndex(undefined);
                updateBoxShadows(
                  new BoxShadows(arrayMoveIndex(boxShadows.shadows, from, to)),
                );
              }}
            >
              {rows.map((shadow, i) => {
                const color = shadow ? colors.selected[i] ?? derefTokenRefs([], shadow.color) : undefined;
                const token = labels.selected[i];
                const kind = t(shadow ? shadow.inset ? "Inset" : "Outset" : "None");
                const summary = shadow ? [shadow.x, shadow.y, shadow.blur, shadow.spread]
                  .map((dim) => dim.showCss())
                  .join(" · ") : undefined;
                const preview = shadow ? replaceAllTokenRefs(
                  assetResolved[i],
                  (id) => thumbnails.selected[requests.indexOf(`var(--token-${id})`)],
                ) : undefined;
                return (
                  <ListBoxItem
                    key={i}
                    index={i}
                    className={paintStyles.fillItem}
                    clickable={false}
                    truncate={false}
                    disabled={isDisabled}
                    isDragDisabled={isDisabled || boxShadows.shadows.length < 2}
                    removeLabel={shadow ? t("Remove") : t("Remove None override")}
                    onRemove={() => {
                      if (isDisabled) { return; }
                      setInspectedIndex(undefined);
                      updateBoxShadows(
                        new BoxShadows(boxShadows.shadows.filter((_, index) => index !== i)),
                      );
                    }}
                    mainContent={
                      <div className={cx(paintStyles.fillValue, "flex-fill")}>
                        <StyleEditorPopover
                          title={title}
                          open={!isDisabled && inspectedIndex === i}
                          onOpenChange={(open) => {
                            setInspectedIndex((current) =>
                              open ? i : current === i ? undefined : current,
                            );
                          }}
                          content={
                            <BoxShadowPanel
                              expsProvider={expsProvider}
                              defaultShadow={shadow}
                              onUpdated={(updated) => {
                                if (isDisabled) { return; }
                                if (!updated) {
                                  updateBoxShadows(null);
                                  setInspectedIndex(0);
                                  return;
                                }
                                updateBoxShadows(new BoxShadows(
                                  shadow ? boxShadows.shadows.map((current, index) =>
                                    index === i ? updated : current,
                                  ) : [updated],
                                ));
                              }}
                              vsh={vsh}
                            />
                          }
                        >
                          <button
                            type="button"
                            className={paintStyles.fillEdit}
                            disabled={isDisabled}
                            aria-label={shadow ? `${title}: ${kind}, ${token?.name ?? color}, ${summary}` : `${title}: ${kind}`}
                            title={shadow ? `${kind}, ${token?.name ?? color}, ${summary}` : kind}
                          >
                            {shadow ? <>
                            <span
                              className={cx(paintStyles.fillSwatch, paintStyles.shadowSwatch)}
                              aria-hidden="true"
                              title={token?.name ?? color}
                            >
                              <span style={{ backgroundColor: color, boxShadow: preview }} />
                            </span>
                            <span className={shadowStyles.kind} title={kind}>
                              <ShadowKindIcon inset={!!shadow.inset} />
                            </span>
                            {token && <span className={paintStyles.fillLabel}>{token.name}</span>}
                            <span className={shadowStyles.summary}>{summary}</span>
                            </> : <>
                              <FiSlash className={shadowStyles.kind} />
                              <span className={paintStyles.fillLabel}>{kind}</span>
                            </>}
                          </button>
                        </StyleEditorPopover>
                      </div>
                    }
                  />
                );
              })}
            </ListBox>
          </StyleWrapper>
        )}
      </StylePanelSection>
    );
}
