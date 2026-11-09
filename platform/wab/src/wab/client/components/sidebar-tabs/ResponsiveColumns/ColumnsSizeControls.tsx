import { useColumnsWrapInputs } from "@/wab/client/studio-ctx/columns-wrap-inputs";
import S from "@/wab/client/components/sidebar-tabs/ResponsiveColumns/ColumnsSizeControls.module.scss";
import {
  addNewColumn,
  prefixSum,
} from "@/wab/client/components/sidebar-tabs/ResponsiveColumns/tpl-columns-utils";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import DoubleDotsVerticalSvgIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__DoubleDotsVerticalSvg";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { XDraggable } from "@/wab/commons/components/XDraggable";
import {
  calcMovedColSizes,
  updateCurrentTplColumns,
} from "@/wab/shared/columns-utils";
import { spawn } from "@/wab/shared/common";
import { TplColumnsTag } from "@/wab/shared/core/tpls";
import { ColumnsConfig } from "@/wab/shared/model/classes";
import { Tooltip } from "antd";
import cn from "classnames";
import { isEqual, isUndefined } from "lodash";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { useCssVariableInputs } from "@/wab/client/studio-ctx/grid-css-inputs";
import { useStore } from "zustand";
import { ok } from "neverthrow";
import React from "react";

interface ColumnSizeDragState {
  index: number;
  cols: number[];
}

export const ColumnsSizeControls = React.memo(function ColumnsSizeControls(props: {
    viewCtx: ViewCtx;
    tpl: TplColumnsTag;
    config: ColumnsConfig | undefined;
    isDisabled?: boolean;
  }) {
    const { tpl, viewCtx, config, isDisabled } = props;
    const { colsSizes } = useColumnsWrapInputs(viewCtx, tpl, config);

    const [dragState, setDragState] = React.useState<
      ColumnSizeDragState | undefined
    >(undefined);

    const columnBlockSize = 264;

    return (
      <FullRow>
        <div className={S.wrapper}>
          <div
            className={S.controlsWrapper}
            style={{
              cursor: dragState ? "ew-resize" : undefined,
            }}
          >
            {colsSizes.map((size, idx) => {
              return (
                <div
                  key={`rc-column-control-${idx}`}
                  className={S.columnWrapper}
                  style={{
                    width: `${(100 * size) / 12}%`,
                  }}
                >
                  <div className={S.columnContent}>
                    <span>{size}</span>
                  </div>
                </div>
              );
            })}
            {!isDisabled ? (
              <ColumnSizeControlDraggables
                tpl={tpl}
                viewCtx={viewCtx}
                sizes={[...colsSizes]}
                dragState={dragState}
                width={columnBlockSize}
                zoom={1}
                isCanvas={false}
                setDragState={setDragState}
              />
            ) : null}
          </div>
        </div>
      </FullRow>
    );
});

export const ColumnSizeControlDraggables = React.memo(
  function ColumnSizeControlDraggables(props: {
    tpl: TplColumnsTag;
    viewCtx: ViewCtx;
    sizes: number[];
    dragState: ColumnSizeDragState | undefined;
    width: number;
    zoom: number;
    isCanvas: boolean;
    setDragState: (s: ColumnSizeDragState | undefined) => void;
  }) {
    const { t: uiT } = useI18n();
    const {
      tpl,
      viewCtx,
      sizes,
      dragState,
      width,
      zoom,
      isCanvas,
      setDragState,
    } = props;

    const provider = React.useMemo(() => new TplExpsProvider(viewCtx, tpl), [viewCtx, tpl]);
    const gap = useStyleCells(provider, isCanvas ? ["column-gap"] : [])[0];
    const colGapRaw = isCanvas ? gap?.value || "0px" : "0px";
    const resolved = useCssVariableInputs(provider, colGapRaw, viewCtx.disposeSignal);
    const colGap = resolved.value ?? colGapRaw;
    const models = React.useMemo(() => viewCtx.studioCtx.modelSnapshots, [viewCtx, tpl]);
    const childCount = useStore(models.field(tpl, "children"), (children) => children.length);
    const isActive = () => !viewCtx.disposeSignal.aborted && viewCtx.studioCtx.modelSnapshots === models;
    const colGapInZoom = `${colGap} * ${zoom}`;
    const areaWidth = `(100% - ${sizes.length - 1} * ${colGapInZoom})`;

    const [mouseOver, setMouseOver] = React.useState<number | undefined>(
      undefined,
    );

    return (
      <>
        {prefixSum(sizes)
          .slice(0, -1)
          .map((size, idx) => {
            if (dragState && dragState.index !== idx) {
              return null;
            }
            return (
              <XDraggable
                key={`rc-column-control-${isCanvas}-${idx}`}
                onStart={(_) => {
                  if (!isActive()) { return; }
                  viewCtx.startUnlogged();
                  setDragState({
                    index: idx,
                    cols: sizes,
                  });
                }}
                onDrag={(e) => {
                  if (dragState) {
                    const delta = e.data.deltaX / zoom;
                    const newCols = calcMovedColSizes(
                      dragState.cols,
                      dragState.index,
                      delta,
                      width,
                    );
                    if (!isEqual(newCols, sizes)) {
                      spawn(
                        viewCtx.studioCtx.change(() => {
                          if (!isActive()) { return ok(); }
                          updateCurrentTplColumns(
                            tpl,
                            {
                              colsSizes: newCols,
                            },
                            viewCtx.variantTplMgr(),
                          );
                          return ok();
                        }),
                      );
                    }
                  }
                }}
                onStop={(e) => {
                  if (!isActive()) { setDragState(undefined); return; }
                  viewCtx.stopUnlogged();
                  setDragState(undefined);
                }}
              >
                <div
                  className={isCanvas ? S.canvasColumnBtn : S.columnResizer}
                  style={{
                    left: `calc(${areaWidth} * ${size / 12} + ${
                      idx + 0.5
                    } * ${colGapInZoom})`,
                  }}
                  onMouseEnter={() => setMouseOver(idx)}
                  onMouseLeave={() => setMouseOver(undefined)}
                >
                  {isCanvas && (
                    <Tooltip
                      title={uiT("Drag to adjust the size of your columns")}
                    >
                      <Icon icon={DoubleDotsVerticalSvgIcon} size={12} />
                    </Tooltip>
                  )}
                </div>
              </XDraggable>
            );
          })}
        {isCanvas && (
          <>
            <IconLinkButton
              className={cn(S.canvasColumnBtn, S.canvasColumnPlusBtn)}
              disabled={childCount === 12}
              onClick={async () =>
                await viewCtx.studioCtx.change<never>(() => {
                  if (!isActive()) { return ok(); }
                  addNewColumn(tpl, viewCtx);
                  return ok();
                })
              }
            >
              <Tooltip title={uiT("Add a new column")}>
                <Icon icon={PlusIcon} />
              </Tooltip>
            </IconLinkButton>
            {(!isUndefined(mouseOver) || dragState) && (
              <BeamLine
                dragState={{
                  cols: sizes,
                  index: mouseOver || dragState?.index || 0,
                }}
                areaWidth={areaWidth}
                colGapInZoom={colGapInZoom}
              />
            )}
          </>
        )}
      </>
    );
  },
);

export const BeamLine = (props: {
  dragState: ColumnSizeDragState;
  areaWidth: string;
  colGapInZoom: string;
}) => {
  const { dragState, areaWidth, colGapInZoom } = props;
  const { index, cols } = dragState;
  const sizes = prefixSum(cols);
  const at = sizes[index];

  return (
    <div
      key={`canvas-column-beam-${at}`}
      className={S.canvasColumnBeamLine}
      style={{
        left: `calc(${areaWidth} * ${at / 12} + ${
          index + 0.5
        } * ${colGapInZoom})`,
      }}
    ></div>
  );
};
