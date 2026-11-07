import type { QueryBuilderConfig } from "@plasmicapp/host";
import type { Field } from "@react-querybuilder/core";
import type { RulesLogic } from "json-logic-js";
import { cleanUrl } from "./utils";

/**
 * Predefined field configuration for WordPress Posts
 */
export const WORDPRESS_POST_FIELDS: Record<
  string,
  Omit<Field, "name"> & { label: string }
> = {
  id: {
    datatype: "number",
    inputType: "number",
    valueEditorType: "text",
    label: "ID",
    operators: ["=", "!="].map((name) => ({ name, label: name })),
  },
  date: {
    datatype: "datetime",
    inputType: "datetime-local",
    valueEditorType: "text",
    label: "Published Date",
    operators: ["<", ">"].map((name) => ({ name, label: name })),
    defaultOperator: ">", // this prevents "equals" operator from being shown by default
  },
  modified: {
    datatype: "datetime",
    inputType: "datetime-local",
    valueEditorType: "text",
    label: "Modified Date",
    operators: ["<", ">"].map((name) => ({ name, label: name })),
    defaultOperator: ">",
  },
  slug: {
    datatype: "text",
    inputType: "text",
    valueEditorType: "text",
    label: "Slug",
    operators: ["="].map((name) => ({ name, label: name })),
  },
  author: {
    datatype: "number",
    inputType: "number",
    valueEditorType: "text",
    label: "Author ID",
    operators: ["=", "!="].map((name) => ({ name, label: name })),
  },
  categories: {
    datatype: "multiselect",
    inputType: "text",
    valueEditorType: "multiselect",
    label: "Category",
    operators: ["in", "notIn"].map((name) => ({ name, label: name })),
    defaultOperator: "in",
    values: [],
  },
  tags: {
    datatype: "multiselect",
    inputType: "text",
    valueEditorType: "multiselect",
    label: "Tag",
    operators: ["in", "notIn"].map((name) => ({ name, label: name })),
    defaultOperator: "in",
    values: [],
  },
  sticky: {
    datatype: "boolean",
    inputType: "text",
    valueEditorType: "checkbox",
    label: "Sticky",
    operators: ["="].map((name) => ({ name, label: name })),
  },
  search: {
    datatype: "text",
    inputType: "text",
    valueEditorType: "text",
    label: "Search",
    operators: ["="].map((name) => ({ name, label: name })),
  },
  search_columns: {
    datatype: "multiselect",
    inputType: "text",
    valueEditorType: "multiselect",
    label: "Search Columns",
    operators: ["in"].map((name) => ({ name, label: name })),
    defaultOperator: "in",
    values: ["post_title", "post_content", "post_excerpt"].map((name) => ({
      name,
      label: name,
    })),
  },
};

/**
 * Predefined field configuration for WordPress Pages
 */
export const WORDPRESS_PAGE_FIELDS: Record<
  string,
  Omit<Field, "name"> & { label: string }
> = {
  id: WORDPRESS_POST_FIELDS.id,
  date: WORDPRESS_POST_FIELDS.date,
  modified: WORDPRESS_POST_FIELDS.modified,
  slug: WORDPRESS_POST_FIELDS.slug,
  author: WORDPRESS_POST_FIELDS.author,
  search: WORDPRESS_POST_FIELDS.search,
  search_columns: WORDPRESS_POST_FIELDS.search_columns,
  // Page-specific fields
  parent: {
    datatype: "number",
    inputType: "number",
    valueEditorType: "text",
    label: "Parent Page",
    operators: ["=", "!="].map((name) => ({ name, label: name })),
  },
  menu_order: {
    datatype: "number",
    inputType: "number",
    valueEditorType: "text",
    label: "Menu Order",
    operators: ["="].map((name) => ({ name, label: name })),
  },
};

/**
 * Fetch categories for multiselect dropdown to allow filtering by category
 */
export async function fetchCategories(
  wordpressUrl: string,
): Promise<Array<{ value: number; title: string }>> {
  try {
    const url = `${cleanUrl(
      wordpressUrl,
    )}/wp-json/wp/v2/categories?per_page=100`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }

    const categories = await resp.json();
    const formatted = categories.map((cat: any) => ({
      value: cat.id,
      title: cat.name,
    }));

    return formatted;
  } catch (error) {
    console.error("Failed to fetch WordPress categories:", error);
    return [];
  }
}

/**
 * Fetch tags for multiselect dropdown to allow filtering by tag
 */
export async function fetchTags(
  wordpressUrl: string,
): Promise<Array<{ value: number; title: string }>> {
  try {
    const url = `${cleanUrl(wordpressUrl)}/wp-json/wp/v2/tags?per_page=100`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }

    const tags = await resp.json();
    const formatted = tags.map((tag: any) => ({
      value: tag.id,
      title: tag.name,
    }));

    return formatted;
  } catch (error) {
    console.error("Failed to fetch WordPress tags:", error);
    return [];
  }
}

/**
 * Build complete query builder configuration for WordPress
 */
export function buildWordPressConfig(
  queryType: "posts" | "pages",
  categories?: Array<{ value: number; title: string }>,
  tags?: Array<{ value: number; title: string }>,
): QueryBuilderConfig {
  const fields =
    queryType === "posts"
      ? { ...WORDPRESS_POST_FIELDS }
      : { ...WORDPRESS_PAGE_FIELDS };

  if (queryType === "posts" && categories && tags) {
    fields.categories = {
      ...fields.categories,
      values: categories.map(({ value, title }) => ({
        name: String(value),
        value,
        label: title,
      })),
    };

    fields.tags = {
      ...fields.tags,
      values: tags.map(({ value, title }) => ({
        name: String(value),
        value,
        label: title,
      })),
    };
  }

  return {
    fields: Object.entries(fields).map(([name, field]) => ({ name, ...field })),
    combinators: [{ name: "and", label: "AND" }],
    showNotToggle: false,
    showAddGroupAction: false,
  };
}

export interface WordPressFilters {
  // Common
  search?: string;
  slug?: string;
  include?: number[];
  exclude?: number[];
  // Pagination
  page?: number;
  per_page?: number;
  offset?: number;
  // Ordering
  order?: "asc" | "desc";
  orderby?: string;
  // Posts-specific
  author?: number | number[];
  author_exclude?: number[];
  categories?: number[];
  tags?: number[];
  before?: string;
  after?: string;
  modified_before?: string;
  modified_after?: string;
  sticky?: boolean;
  // Pages-specific
  parent?: number[];
  parent_exclude?: number[];
  menu_order?: number;
}

/**
 * Convert QueryBuilder JsonLogic to WordPress REST API query parameters
 */
export function rulesLogicToWordPressFilters(
  logic: RulesLogic | undefined,
): WordPressFilters {
  if (logic === null || logic === undefined) {
    return {};
  } else if (typeof logic !== "object") {
    throw new Error(`unexpected logic: ${JSON.stringify(logic)}`);
  } else if ("and" in logic) {
    return handleAndGroup(logic.and);
  }

  return handleCondition(logic);
}

function handleAndGroup(conditions: any[]): WordPressFilters {
  const filters: WordPressFilters = {};

  for (const condition of conditions) {
    const result = handleCondition(condition);
    Object.assign(filters, result);
  }

  return filters;
}

function handleCondition(condition: any, negated = false): WordPressFilters {
  if ("in" in condition) {
    const [field, values] = condition.in;
    if (
      typeof field === "object" &&
      field !== null &&
      "var" in field &&
      Array.isArray(values)
    ) {
      return negated
        ? convertNotEqualOperator(field.var, values)
        : convertEqualOperator(field.var, values);
    }
  }

  if ("!" in condition) {
    return handleCondition(condition["!"], true);
  }

  if ("==" in condition) {
    const [fieldExpr, value] = condition["=="];
    if ("var" in fieldExpr) {
      return negated
        ? convertNotEqualOperator(fieldExpr.var, value)
        : convertEqualOperator(fieldExpr.var, value);
    }
  }

  if ("!=" in condition) {
    const [fieldExpr, value] = condition["!="];
    if ("var" in fieldExpr) {
      return negated
        ? convertEqualOperator(fieldExpr.var, value)
        : convertNotEqualOperator(fieldExpr.var, value);
    }
  }

  if ("<" in condition) {
    const [fieldExpr, value] = condition["<"];
    if ("var" in fieldExpr) {
      return convertLessThanOperator(fieldExpr.var, value);
    }
  }

  if (">" in condition) {
    const [fieldExpr, right] = condition[">"];
    if ("var" in fieldExpr) {
      return convertGreaterThanOperator(fieldExpr.var, right);
    }
  }

  throw new Error(
    `Unsupported WordPress filter condition: ${JSON.stringify(condition)}`,
  );
}

function convertEqualOperator(field: string, value: any): WordPressFilters {
  if (field === "id") {
    return { include: value };
  }
  return { [field]: value };
}

function convertNotEqualOperator(field: string, value: any): WordPressFilters {
  if (field === "id") {
    return { exclude: value };
  }
  return { [`${field}_exclude`]: value };
}

function convertLessThanOperator(field: string, value: any): WordPressFilters {
  if (field === "date") {
    return { before: value };
  }
  if (field === "modified") {
    return { modified_before: value };
  }
  console.warn(
    `WordPress: Less than operator not supported for field: ${field}`,
  );
  return {};
}

function convertGreaterThanOperator(
  field: string,
  value: any,
): WordPressFilters {
  if (field === "date") {
    return { after: value };
  }
  if (field === "modified") {
    return { modified_after: value };
  }
  console.warn(
    `WordPress: Greater than operator not supported for field: ${field}`,
  );
  return {};
}
