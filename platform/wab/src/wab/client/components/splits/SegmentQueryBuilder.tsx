import { FilterQueryBuilder } from "@/wab/client/components/QueryBuilder/FilterQueryBuilder";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import {
  getEmptyQuery,
  isQueryComplete,
  queryFromJsonLogic,
  queryToJsonLogic,
} from "@/wab/shared/query-builder";
import { TraitRegistration } from "@plasmicapp/host";
import {
  formatQuery,
  type Field,
  type RuleGroupType,
} from "@react-querybuilder/core";
import * as React from "react";

function traitFields(traits: TraitRegistration[]): Field[] {
  return traits.map(({ trait, meta }) => ({
    name: trait,
    label: meta.label ?? trait,
    datatype: meta.type === "choice" ? "select" : meta.type,
    inputType: meta.type === "number" ? "number" : "text",
    valueEditorType:
      meta.type === "choice"
        ? "select"
        : meta.type === "boolean"
          ? "checkbox"
          : "text",
    ...(meta.type === "choice"
      ? { values: meta.options.map((name) => ({ name, label: name })) }
      : {}),
  }));
}
function SegmentQueryBuilder_(
  { logic, saveLogic }: { logic: any; saveLogic: (logic: any) => void },
  outerRef: React.Ref<HTMLDivElement>,
) {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const fields: Field[] = [
    {
      name: "time",
      label: t("Time"),
      datatype: "datetime",
      inputType: "datetime-local",
      operators: ["=", "!=", "<", "<=", ">", ">="].map((name) => ({
        name,
        label: name,
      })),
    },
    ...traitFields(studioCtx.getRegisteredTraits()),
  ];
  const [tree, setTree] = React.useState<RuleGroupType>(() =>
    logic ? queryFromJsonLogic(logic, fields) : getEmptyQuery(fields, true),
  );
  return (
    <div className="plasmic-query-builder-scope" ref={outerRef}>
      <FilterQueryBuilder
        config={{ fields }}
        value={tree}
        onChange={(next) => {
          setTree(next);
          if (!next.rules.length) {
            saveLogic(undefined);
          } else if (isQueryComplete(next, fields)) {
            saveLogic(queryToJsonLogic(next, fields));
          }
        }}
      />
    </div>
  );
}
export function getHumanFormatRules(logic: any) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const fields: Field[] = [
    {
      name: "time",
      label: t("Time"),
      datatype: "datetime",
      inputType: "datetime-local",
    },
    ...traitFields(studioCtx.getRegisteredTraits()),
  ];
  return logic
    ? formatQuery(queryFromJsonLogic(logic, fields), {
        format: "natural_language",
        fields,
      })
    : "";
}
export default React.forwardRef(SegmentQueryBuilder_);
