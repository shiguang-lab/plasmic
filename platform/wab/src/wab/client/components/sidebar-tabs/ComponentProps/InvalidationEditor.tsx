import { useFocusedViewCtx } from "@/wab/client/studio-ctx/selection-state";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import styles from "@/wab/client/components/sidebar-tabs/ComponentProps/InvalidationEditor.module.scss";
import { MultiSelectEnumPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/MultiSelectEnumPropEditor";
import { DataPickerTypesSchema } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import Trash2SvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Trash2Svg";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import { ensure, notNil } from "@/wab/shared/common";
import {
  createExprForDataPickerValue,
  extractValueSavedFromDataPicker,
} from "@/wab/shared/core/exprs";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import {
  ALL_QUERIES,
  SHOW_INVALIDATION_KEYS,
} from "@/wab/shared/data-sources-meta/data-sources";
import {
  Component,
  ComponentDataQuery,
  ComponentServerQuery,
  CustomFunction,
  QueryInvalidationExpr,
  QueryRef,
  isKnownComponentServerQuery,
  isKnownCustomCode,
  isKnownCustomFunctionExpr,
} from "@/wab/shared/model/classes";
import { smartHumanize } from "@/wab/shared/strs";
import { Menu } from "antd";
import { isString, uniq } from "lodash";
import { useQueryInvalidationInputs } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs";
import * as React from "react";

export const InvalidationEditor = React.memo(function InvalidationKeysEditor({
  value,
  onChange,
  data,
  schema,
  disabled,
  layout = "horizontal",
  component,
}: {
  value?: QueryInvalidationExpr;
  onChange: (value: QueryInvalidationExpr) => void;
  data?: Record<string, any>;
  schema?: DataPickerTypesSchema;
  disabled?: boolean;
  layout?: "vertical" | "horizontal";
  component?: Component | null;
}) {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const viewCtx = useFocusedViewCtx(studioCtx);
  const queryInputs = useQueryInvalidationInputs(studioCtx, value);
  const firstRenderRef = React.useRef(true);
  React.useLayoutEffect(() => {
    if (!firstRenderRef.current) {
      return;
    }
    firstRenderRef.current = false;
  }, []);
  const { invalidationQueries, invalidationKeys } = queryInputs?.value ?? {
    invalidationQueries: [ALL_QUERIES.value] as (string | QueryRef)[],
    invalidationKeys: undefined,
  };
  const [showKeysEditor, setShowKeysEditor] = React.useState(
    notNil(invalidationKeys),
  );
  const [isDataPickerVisible, setIsDataPickerVisible] = React.useState(false);

  const queryOptions = queryInputs?.options.map(option => ({
    value: option.value,
    label: option.count === undefined ? option.name : uiT(option.count === 1 ? "{name} (1 query)" : "{name} ({count} queries)", {name: option.name, count: option.count}),
  })) ?? [];
  const valueToRef = new Map(queryInputs?.options.map(option => [option.value, option.ref]));
  if (queryInputs === null) { return null; }
  const selected = queryInputs.selectedValues;
  const multiSelectValues = selected ? invalidationQueries.some(isString) ? [ALL_QUERIES.value] : uniq([...selected]) : [ALL_QUERIES.value];
  const commitChange = (next: QueryInvalidationExpr) => { if (queryInputs.isCurrent()) { onChange(next); } };

  return (
    <>
      <MaybeWrap
        cond={layout === "horizontal"}
        wrapper={(children) => (
          <LabeledItemRow
            className="flex-vcenter-important"
            label={uiT("Refresh queries")}
            key={"invalidationQueries"}
          >
            {children}
          </LabeledItemRow>
        )}
      >
        <MultiSelectEnumPropEditor
          value={multiSelectValues}
          onChange={(val) => {
            if (!val) {
              commitChange(
                new QueryInvalidationExpr({
                  invalidationQueries: [],
                  invalidationKeys: invalidationKeys,
                }),
              );
            } else if (val.find((v) => v === SHOW_INVALIDATION_KEYS.value)) {
              setShowKeysEditor(true);
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement?.blur();
              }
            } else if (
              !invalidationQueries.find((v) => v === ALL_QUERIES.value) &&
              val.find((v) => v === ALL_QUERIES.value)
            ) {
              commitChange(
                new QueryInvalidationExpr({
                  invalidationQueries: [ALL_QUERIES.value],
                  invalidationKeys: invalidationKeys,
                }),
              );
            } else {
              commitChange(
                new QueryInvalidationExpr({
                  invalidationQueries: val
                    .filter(
                      (v) =>
                        v !== ALL_QUERIES.value &&
                        v !== SHOW_INVALIDATION_KEYS.value,
                    )
                    .map((v) => {
                      return new QueryRef({
                        ref: ensure(
                          valueToRef.get(v),
                          "Selection must be a query ref",
                        ),
                      });
                    }),
                  invalidationKeys: invalidationKeys,
                }),
              );
            }
          }}
          options={[
            ALL_QUERIES,
            ...queryOptions,
            ...(showKeysEditor ? [] : [SHOW_INVALIDATION_KEYS]),
          ]}
          disabled={disabled}
        />
      </MaybeWrap>
      {showKeysEditor && (
        <LabeledItemRow
          className={
            layout === "horizontal" ? "flex-vcenter-important" : undefined
          }
          label={uiT("Refresh query groups")}
          key={"invalidationKeys"}
          layout={layout}
          menu={
            <Menu>
              <Menu.Item
                onClick={() => {
                  commitChange(
                    new QueryInvalidationExpr({
                      invalidationQueries: invalidationQueries,
                      invalidationKeys: undefined,
                    }),
                  );
                  setShowKeysEditor(false);
                }}
              >
                <UiText message={"Remove query groups"} />
              </Menu.Item>
            </Menu>
          }
          rightExtras={
            <IconButton
              className={styles[`rightTrashIcon--${layout}`]}
              onClick={() => {
                commitChange(
                  new QueryInvalidationExpr({
                    invalidationQueries: invalidationQueries,
                    invalidationKeys: undefined,
                  }),
                );
                setShowKeysEditor(false);
              }}
            >
              <Icon icon={Trash2SvgIcon} />
            </IconButton>
          }
        >
          <DataPickerEditor
            viewCtx={viewCtx}
            value={extractValueSavedFromDataPicker(invalidationKeys, {
              projectFlags: studioCtx.projectFlags(),
              component: component ?? null,
              inStudio: true,
            })}
            onChange={(val) => {
              if (!val) {
                return;
              }
              const newExpr = createExprForDataPickerValue(val);
              commitChange(
                new QueryInvalidationExpr({
                  invalidationQueries: invalidationQueries,
                  invalidationKeys: newExpr,
                }),
              );
            }}
            visible={isDataPickerVisible && showKeysEditor}
            setVisible={setIsDataPickerVisible}
            expectedValues="String or List of Strings"
            data={data}
            schema={schema}
          />
        </LabeledItemRow>
      )}
    </>
  );
});
