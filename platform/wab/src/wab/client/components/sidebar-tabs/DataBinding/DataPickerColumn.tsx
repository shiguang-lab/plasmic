import { useDataPickerSourceInputs } from "@/wab/client/components/sidebar-tabs/DataBinding/data-picker-source-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import sty from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumn.module.scss";
import { DataPickerVirtualList } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerVirtualList";
import DataPickerColumnItem from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumnItem";
import {
  ColumnItem,
  DataPickerOpts,
  evalExpr,
  getDollarVarIcon,
  getItemPath,
  getSourceUiId,
  getSupportedObjectKeys,
  getVariableType,
  isListType,
  isTypeSupported,
} from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerUtil";
import { useViewCtxMaybe } from "@/wab/client/contexts/StudioContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultDataPickerColumnProps,
  PlasmicDataPickerColumn,
} from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerColumn";
import { BLOCKED_RUN_INTERACTION_ONLY_BY_EVENT_ARGS_MESSAGE } from "@/wab/client/state-management/interactions-meta";
import {
  canRunInteraction,
  runInteraction,
} from "@/wab/client/state-management/preview-steps";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ensure } from "@/wab/shared/common";
import { isTplTagOrComponent } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { pathToString } from "@/wab/shared/eval/expression-parser";
import { ensureKnownInteraction } from "@/wab/shared/model/classes";
import { mkMetaName } from "@plasmicapp/host";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { notification } from "antd";
import * as React from "react";
import { useStore } from "zustand";

export interface DataPickerColumnProps extends DefaultDataPickerColumnProps {
  data: Record<string, any> | undefined;
  columnIndex: number;
  selectedItem: number | undefined;
  isActiveColumn: boolean;
  columnItems: ColumnItem[];
  onItemSelected: (column: number, item: number) => void;
  opts: DataPickerOpts;
  onCancelDataPicker?: () => void;
  // Error message shown in place of data fields when set.
  errorMessage?: string;
}

/** The contents of a column standing in for data that failed to resolve. */
function ColumnErrorNotice(props: { columnIndex: number; message: string }) {
  const { columnIndex, message } = props;
  return (
    <div
      className={sty.columnError}
      data-test-id={`data-picker-column-${columnIndex}-error`}
    >
      <div className={sty.columnErrorTitle}>
        <UiText message={"Error"} />
      </div>
      <div className={sty.columnErrorMessage}>{message}</div>
    </div>
  );
}

function DataPickerColumn_(props: DataPickerColumnProps, ref: HTMLElementRefOf<"div">) {
  return props.data
    ? <BoundDataPickerColumn {...props} data={props.data} rootRef={ref} />
    : <PlasmicDataPickerColumn root={{ ref }} children={undefined} />;
}

type BoundColumnProps = Omit<DataPickerColumnProps, "data"> & { data: Record<string, any>; rootRef: HTMLElementRefOf<"div"> };
function BoundDataPickerColumn(props: BoundColumnProps) {
  const studio = useStudioCtx(), view = useViewCtxMaybe();
  const world = useVariantModelWorld(studio, props.data, view);
  return world.alive ? <DataPickerColumnContent {...props} /> : null;
}
const DataPickerColumnContent = React.memo(function DataPickerColumnContent({ rootRef: ref, ...props }: Omit<DataPickerColumnProps, "data"> & { data: Record<string, any>; rootRef: HTMLElementRefOf<"div"> }) {
  const {
    data,
    columnIndex,
    selectedItem,
    columnItems,
    onItemSelected,
    isActiveColumn,
    opts,
    onCancelDataPicker,
    errorMessage,
    ...rest
  } = props;
  const studioCtx = useStudioCtx();
  const viewCtx = useViewCtxMaybe();
  const componentRef = useViewVariants(viewCtx, (state) => state.frames.at(-1)?.component);
  const component = componentRef ? studioCtx.modelSnapshots.resolve(componentRef) : viewCtx?.component;
  const paths = React.useMemo(() => columnItems.map(getItemPath), [columnItems]);
  const rows = React.useMemo(
    () => columnItems.flatMap((item, index) => {
      const variableType = getVariableType(item.value);
      return isTypeSupported(variableType) ? [{ index, item, variableType }] : [];
    }),
    [columnItems],
  );
  const sourceLinks = useDataPickerSourceInputs(studioCtx, component, paths,
    () => Object.freeze(paths.map((path) => component ? getSourceUiId(path, studioCtx.site, component) : undefined)));
  const world = useVariantModelWorld(studioCtx, data, viewCtx);
  const getInteraction = (key: string) => data["$steps"]?.[mkMetaName(key)]?.interaction;
  // Rebuild the per-row lookup whenever the cache changes; a keyed hook per row
  // is not possible inside the render map.
  const stepValues = useStore(studioCtx.stepsCacheStore, (state) => state.values);
  const wasStepExecuted = (key: string) => {
    const interaction = getInteraction(key);
    return interaction && stepValues[interaction.uuid] !== undefined;
  };
  const pathPrefix = columnItems.find((item) => item.pathPrefix)?.pathPrefix;
  const isStepsColumn = pathPrefix && pathPrefix.length === 1 && pathPrefix[0] === "$steps";
  const subscribeFlags = React.useCallback((listener: () => void) => studioCtx.appCtx.subscribeUiEnvironmentInputs(listener), [studioCtx]);
  React.useSyncExternalStore(subscribeFlags, () => `${DEVFLAGS.previewSteps}:${DEVFLAGS.demo}`, () => `${DEVFLAGS.previewSteps}:${DEVFLAGS.demo}`);
  const enabledPreviewSteps = DEVFLAGS.previewSteps;

  return (
    <PlasmicDataPickerColumn
      root={{ ref, id: `data-picker-column-${columnIndex}` }}
      {...rest}
      previewSteps={enabledPreviewSteps && isStepsColumn}
      freeBox={
        errorMessage == null
          ? { style: { minHeight: 0 } }
          : { as: Scrollbar, props: { scrollX: false } }
      }
      children={
        errorMessage != null ? (
          <ColumnErrorNotice columnIndex={columnIndex} message={errorMessage} />
        ) : (
          <DataPickerVirtualList
            count={rows.length}
            rowHeight={52}
            itemKey={(row) => pathToString(paths[rows[row].index])}
            selectedIndex={isActiveColumn ? rows.findIndex((row) => row.index === selectedItem) : undefined}
            renderRow={(row) => {
              const { index, item, variableType } = rows[row];
              const { name: key, label, value } = item;
              const path = paths[index];
              const keyCount = isListType(variableType)
                ? getSupportedObjectKeys(value, opts).length
                : 0;
              // Indicator for a row whose data errored.
              const errorPreview =
                item.errorMessage != null ? "error" : undefined;
              const previewValue =
                errorPreview ??
                (!isListType(variableType)
                  ? evalExpr(
                      path,
                      ensure(data, "Should only be called if data exists"),
                    )
                  : variableType === "array"
                    ? keyCount + ` item${keyCount === 1 ? "" : "s"}`
                    : undefined);
              const isSelected = index === selectedItem;
              const sourceUiId = sourceLinks?.[index];
              return (
                <DataPickerColumnItem
                  itemName={label ?? key}
                  variableType={variableType}
                  icon={columnIndex === 0 ? getDollarVarIcon(path) : undefined}
                  previewValue={previewValue}
                  isSelected={isSelected}
                  onClick={() => onItemSelected(columnIndex, index)}
                  onJumpToSource={
                    sourceUiId
                      ? () => {
                          if (!world.isCurrent(viewCtx)) { return; }
                          onCancelDataPicker?.();
                          studioCtx.uiActionBus.dispatch(sourceUiId, "jump");
                        }
                      : undefined
                  }
                  columnIndex={columnIndex}
                  step={
                    isStepsColumn && enabledPreviewSteps
                      ? wasStepExecuted(key)
                        ? "played"
                        : "notPlayed"
                      : undefined
                  }
                  interaction={getInteraction(key)}
                />
              );
            }}
          />
        )
      }
      runAllSteps={{
        onClick: () => {
          if (!world.isCurrent(viewCtx)) { return; }
          const currentInteraction = ensureKnownInteraction(
            data[mkMetaName("$steps")]?.currentInteraction,
          );
          const previousSteps = currentInteraction.parent.interactions.slice(
            0,
            currentInteraction.parent.interactions.indexOf(currentInteraction),
          );
          const vc = studioCtx.focusedViewCtx();
          const tpl = vc?.focusedTpls()?.[0];
          if (!vc || !tpl || !isTplTagOrComponent(tpl)) {
            return;
          }
          for (const interaction of previousSteps) {
            if (!canRunInteraction(interaction, vc, { skipSteps: true })) {
              notification.error({
                message: BLOCKED_RUN_INTERACTION_ONLY_BY_EVENT_ARGS_MESSAGE,
              });
              return;
            }
          }
          for (const interaction of previousSteps) {
            runInteraction(interaction, vc, tpl);
          }
        },
      }}
    />
  );
});

const DataPickerColumn = React.forwardRef(DataPickerColumn_);
export default DataPickerColumn;
