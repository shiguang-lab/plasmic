import { DataPickerWidgetFactory } from "@/wab/client/components/QueryBuilder/Components/DataPickerWidgetFactory";
import {
  FilterQueryBuilder,
  RenderQueryValue,
} from "@/wab/client/components/QueryBuilder/FilterQueryBuilder";
import { useQueryBuilderStyles } from "@/wab/client/components/QueryBuilder/QueryBuilder.styles";
import { usePropValueEditorContext } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { ensure } from "@/wab/shared/common";
import {
  deserCompositeExpr,
  serCompositeExprMaybe,
  tryExtractJson,
} from "@/wab/shared/core/exprs";
import {
  CompositeExpr,
  CustomCode,
  isKnownCompositeExpr,
  isKnownCustomCode,
} from "@/wab/shared/model/classes";
import {
  getEmptyQuery,
  isQueryComplete,
  queryFromJsonLogic,
  queryToJsonLogic,
} from "@/wab/shared/query-builder";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import cn from "classnames";
import type { RulesLogic } from "json-logic-js";
import React from "react";

export type QueryBuilderValue = CustomCode | CompositeExpr;
export interface QueryBuilderPropEditorProps {
  config: QueryBuilderConfig;
  value: RulesLogic | QueryBuilderValue | undefined;
  onChange: (value: QueryBuilderValue) => void;
  disabled?: boolean;
}

function QueryBuilderPropEditor_(
  { config, value, onChange, disabled = false }: QueryBuilderPropEditorProps,
  outerRef: React.Ref<HTMLDivElement>,
) {
  const { env, schema, exprCtx } = usePropValueEditorContext();
  const { styles } = useQueryBuilderStyles();
  const [tree, setTree] = React.useState(() => {
    const logic = isKnownCompositeExpr(value)
      ? deserCompositeExpr(value)
      : isKnownCustomCode(value)
        ? tryExtractJson(value)
        : value;
    return logic
      ? queryFromJsonLogic(logic as RulesLogic, config.fields)
      : getEmptyQuery(config.fields);
  });
  const renderValueEditor: RenderQueryValue = (props, renderInput) =>
    ["in", "notIn"].includes(props.operator) ? (
      renderInput()
    ) : (
      <DataPickerWidgetFactory
        value={props.value}
        disabled={props.disabled}
        setValue={(next) => {
          if (!props.disabled) {
            props.handleOnChange(next);
          }
        }}
        data={env}
        schema={schema}
        exprCtx={ensure(exprCtx, "Missing query expression context")}
        renderOriginalWidget={renderInput}
      />
    );
  return (
    <div
      className={cn("plasmic-query-builder-scope", styles.frame)}
      ref={outerRef}
    >
      <FilterQueryBuilder
        config={config}
        value={tree}
        disabled={disabled}
        renderValueEditor={renderValueEditor}
        onChange={(next) => {
          setTree(next);
          if (!next.rules.length) {
            onChange(serCompositeExprMaybe(undefined));
          } else if (isQueryComplete(next, config.fields)) {
            onChange(
              serCompositeExprMaybe(queryToJsonLogic(next, config.fields)),
            );
          }
        }}
      />
    </div>
  );
}
export const QueryBuilderPropEditor = React.forwardRef(QueryBuilderPropEditor_);
