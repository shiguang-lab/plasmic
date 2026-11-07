import { assert, substringOccurrencesCount } from "@/wab/shared/common";
import { GenericDataSource } from "@/wab/shared/data-sources-meta/data-source-registry";
import { Filters } from "@/wab/shared/data-sources-meta/data-sources";
import {
  getDynamicStringSegments,
  isDynamicValue,
} from "@/wab/shared/dynamic-bindings";
import { isQueryComplete } from "@/wab/shared/query-builder";
import { defaultRuleProcessorSQL, formatQuery } from "@react-querybuilder/core";

export function buildSqlStringForFilterTemplateArg(
  _source: GenericDataSource,
  template: string,
) {
  // We need to temporarily replace the dynamic expressions in order to parse
  // the JSON, as the string might be an invalid JSON. Since the expression
  // might be anywhere in the JSON (possibly inside a string, possibly not),
  // the only values that we can replace them with are numbers, so we need
  // to find digits that don't occur in the string! :/
  const bindings = getDynamicStringSegments(template).filter((seg) =>
    isDynamicValue(seg),
  );
  let substitutedTemplate = template;
  const bindingCodes = bindings.map((binding) => {
    let bindingCode = "";
    while (
      !bindingCode ||
      substitutedTemplate.includes(bindingCode) ||
      substringOccurrencesCount(
        substitutedTemplate.replace(binding, bindingCode),
        bindingCode,
      ) !== 1
    ) {
      // Random 10-digit number
      bindingCode = `${Math.floor((1 << 30) * Math.random())}`;
    }
    substitutedTemplate = substitutedTemplate.replace(binding, bindingCode);
    return bindingCode;
  });
  const filters = JSON.parse(substitutedTemplate) as Filters;
  if (!filters.tree.rules.length) {
    return undefined;
  }
  assert(
    isQueryComplete(filters.tree, filters.fields),
    "Cannot execute an incomplete filter query",
  );
  let sql = formatQuery(filters.tree, {
    format: "sql",
    fields: filters.fields,
    quoteFieldNamesWith: '"',
    ruleProcessor: (rule, options) =>
      defaultRuleProcessorSQL(rule, {
        ...options,
        parseNumbers: options?.fieldData?.datatype === "number",
      }),
  });
  bindingCodes.forEach((bindingCode, i) => {
    if (sql) {
      assert(
        substringOccurrencesCount(sql, bindingCode) === 1,
        () => `Couldn't find binding code ${bindingCode} in SQL string: ${sql}`,
      );
      sql = sql.replace(bindingCode, bindings[i]);
    }
  });
  return sql;
}
