import type { QueryBuilderConfig } from "@plasmicapp/host";
import type { Field } from "@react-querybuilder/core";
import type { RulesLogic } from "json-logic-js";

/**
 * Maps Strapi collection fields to react-querybuilder config.
 *
 * The result will be handled by {@link rulesLogicToStrapiFilters}.
 * Make sure it supports all operators defined here.
 */
export function strapiFieldsToQueryBuilderConfig(
  fields: string[],
  sampleData?: any,
): QueryBuilderConfig {
  const qbFields: { [key: string]: Omit<Field, "name"> & { label: string } } =
    {};
  for (const field of fields) {
    // Try to get sample value from sampleData to infer type
    const sampleValue = sampleData?.[field];
    const qbField = strapiFieldToQueryBuilderField(field, sampleValue);
    if (qbField) {
      qbFields[field] = qbField;
    }
  }
  return {
    fields: Object.entries(qbFields).map(([name, field]) => ({
      name,
      ...field,
    })),
  };
}

/**
 * Maps a Strapi field name to a query builder field configuration.
 *
 * Infers field type from field name patterns and sample values if provided.
 */
function strapiFieldToQueryBuilderField(
  fieldName: string,
  sampleValue?: unknown,
): (Omit<Field, "name"> & { label: string }) | undefined {
  const label = fieldName;

  // Infer type from sample value if provided
  if (typeof sampleValue === "number") {
    return {
      datatype: "number",
      inputType: "number",
      valueEditorType: "text",
      label,
      operators: ["=", "!=", "<", "<=", ">", ">=", "null", "notNull"].map(
        (name) => ({ name, label: name }),
      ),
    };
  }
  if (typeof sampleValue === "boolean") {
    return {
      datatype: "boolean",
      inputType: "text",
      valueEditorType: "checkbox",
      operators: ["=", "!="].map((name) => ({ name, label: name })),
      label,
    };
  }
  if (typeof sampleValue === "string") {
    if (!isNaN(new Date(sampleValue).getTime())) {
      return {
        datatype: "datetime",
        inputType: "datetime-local",
        valueEditorType: "text",
        label,
        operators: ["=", "!=", "<", "<=", ">", ">=", "null", "notNull"].map(
          (name) => ({ name, label: name }),
        ),
      };
    }

    return {
      datatype: "text",
      inputType: "text",
      valueEditorType: "text",
      label,
      operators: [
        "=",
        "!=",
        "contains",
        "doesNotContain",
        "null",
        "notNull",
      ].map((name) => ({ name, label: name })),
    };
  }

  return undefined;
}

/**
 * Maps JsonLogic to Strapi API filters format.
 *
 * See also:
 * - https://docs.strapi.io/cms/api/rest/filters
 */
export function rulesLogicToStrapiFilters(logic: RulesLogic | undefined): any {
  if (logic === null || logic === undefined) {
    return undefined;
  } else if (typeof logic !== "object") {
    throw new Error(`unexpected logic: ${JSON.stringify(logic)}`);
  } else if ("and" in logic) {
    return {
      $and: logic["and"].map(rulesLogicToStrapiFilters),
    };
  } else if ("or" in logic) {
    return {
      $or: logic["or"].map(rulesLogicToStrapiFilters),
    };
  } else if ("!" in logic) {
    return {
      $not: rulesLogicToStrapiFilters(logic["!"]),
    };
  } else if ("==" in logic) {
    const [{ var: field }, operand] = logic["=="] as [{ var: string }, unknown];
    if (operand === null) {
      return { [field]: { $null: true } };
    }
    return {
      [field]: { $eq: operand },
    };
  } else if ("!=" in logic) {
    const [{ var: field }, operand] = logic["!="] as [{ var: string }, unknown];
    if (operand === null) {
      return { [field]: { $notNull: true } };
    }
    return {
      [field]: { $ne: operand },
    };
    // Map in operator to Strapi filters format:
    // JsonLogic: { "in": ["Mairi", { "var": "name" }] }
    // Strapi filters: { "name": { $contains: "Mairi" } }
  } else if ("in" in logic) {
    const [operand, { var: field }] = logic["in"] as [string, { var: string }];
    return {
      [field]: { $contains: operand },
    };
  } else {
    // Map JsonLogic to Strapi filters format:
    // JsonLogic: { "<=": [{ "var": "age" }, 18] }
    // Strapi filters: { "age": { "$lte": 18 } }
    const [key, value] = Object.entries(logic)[0];
    const apiOp: string | undefined = operatorMapping[key];
    if (apiOp) {
      const [{ var: field }, operand] = value as [{ var: string }, unknown];
      return { [field]: { [apiOp]: operand } };
    }

    throw new Error(`unexpected logic: ${JSON.stringify(logic)}`);
  }
}

/** Maps JsonLogic operator to Strapi filter operator. */
const operatorMapping: Record<string, string> = {
  "<": "$lt",
  "<=": "$lte",
  ">": "$gt",
  ">=": "$gte",
};
