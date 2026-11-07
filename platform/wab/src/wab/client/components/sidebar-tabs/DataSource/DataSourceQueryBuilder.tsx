import { DataPickerWidgetFactory } from "@/wab/client/components/QueryBuilder/Components/DataPickerWidgetFactory";
import {
  FilterQueryBuilder,
  RenderQueryValue,
} from "@/wab/client/components/QueryBuilder/FilterQueryBuilder";
import { useQueryBuilderStyles } from "@/wab/client/components/QueryBuilder/QueryBuilder.styles";
import { DataPickerTypesSchema } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { mkBindingId } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { TemplatedTextWidget } from "@/wab/client/components/sidebar-tabs/DataSource/TemplatedTextWidget";
import { arrayEq } from "@/wab/shared/common";
import { ExprCtx } from "@/wab/shared/core/exprs";
import { Filters } from "@/wab/shared/data-sources-meta/data-sources";
import {
  CustomCode,
  ObjectPath,
  TemplatedString,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import { getEmptyQuery } from "@/wab/shared/query-builder";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import cn from "classnames";
import * as React from "react";
import type { RuleGroupType } from "react-querybuilder";

type Bindings = Record<string, TemplatedString | CustomCode | ObjectPath>;
interface DataSourceQueryBuilderProps {
  saveTree: (data: Filters, bindings: Bindings) => void;
  tree: RuleGroupType | undefined;
  dataSourceConfig: QueryBuilderConfig;
  data: Record<string, any> | undefined;
  schema?: DataPickerTypesSchema;
  bindings: Bindings;
  exprCtx: ExprCtx;
}
function DataSourceQueryBuilder_(
  {
    saveTree,
    tree: initial,
    dataSourceConfig: config,
    data,
    schema,
    bindings: initialBindings,
    exprCtx,
  }: DataSourceQueryBuilderProps,
  outerRef: React.Ref<HTMLDivElement>,
) {
  const bindings = React.useRef({ ...initialBindings });
  const { styles } = useQueryBuilderStyles();
  const [tree, setTree] = React.useState(
    () => initial ?? getEmptyQuery(config.fields, true),
  );
  const renderValueEditor: RenderQueryValue = (props, renderInput) => {
    if (["in", "notIn"].includes(props.operator)) {
      return renderInput();
    }
    const boundValue =
      typeof props.value === "string"
        ? bindings.current[props.value]
        : undefined;
    const setValue = (
      value: TemplatedString | CustomCode | ObjectPath | null | undefined,
    ) => {
      if (props.disabled) {
        return;
      }
      if (
        value == null ||
        (isKnownTemplatedString(value) && arrayEq(value.text, [""]))
      ) {
        props.handleOnChange(undefined);
        return;
      }
      const id = mkBindingId();
      bindings.current = { ...bindings.current, [id]: value };
      props.handleOnChange(id);
    };
    if (
      props.fieldData.datatype === "text" &&
      !["in", "notIn", "null", "notNull"].includes(props.operator)
    ) {
      return (
        <TemplatedTextWidget
          value={typeof props.value === "string" ? props.value : undefined}
          disabled={props.disabled}
          bindings={bindings.current}
          setValue={setValue}
          exprCtx={exprCtx}
          data={data}
          schema={schema}
        />
      );
    }
    return (
      <DataPickerWidgetFactory
        value={boundValue ?? props.value}
        disabled={props.disabled}
        setValue={setValue}
        data={data}
        schema={schema}
        exprCtx={exprCtx}
        renderOriginalWidget={() =>
          renderInput(boundValue ? undefined : props.value)
        }
      />
    );
  };
  return (
    <div
      className={cn("plasmic-query-builder-scope", styles.frame)}
      ref={outerRef}
    >
      <FilterQueryBuilder
        config={config}
        value={tree}
        renderValueEditor={renderValueEditor}
        onChange={(next) => {
          setTree(next);
          const serialized = JSON.stringify(next);
          const used = Object.fromEntries(
            Object.entries(bindings.current).filter(([id]) =>
              serialized.includes(id),
            ),
          );
          bindings.current = used;
          saveTree({ tree: next, fields: config.fields }, used);
        }}
      />
    </div>
  );
}
export default React.forwardRef(DataSourceQueryBuilder_);
