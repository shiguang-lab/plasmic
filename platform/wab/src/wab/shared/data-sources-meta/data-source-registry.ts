import { ensure } from "@/wab/shared/common";
import {
  AIRTABLE_META,
  AirtableDataSource,
} from "@/wab/shared/data-sources-meta/airtable-meta";
import { DataSourceMeta } from "@/wab/shared/data-sources-meta/data-sources";
import {
  FAKE_META,
  FakeDataSource,
} from "@/wab/shared/data-sources-meta/fake-meta";
import {
  GRAPHQL_META,
  GraphqlDataSource,
} from "@/wab/shared/data-sources-meta/graphql-meta";
import {
  HTTP_META,
  HttpDataSource,
} from "@/wab/shared/data-sources-meta/http-meta";
import {
  POSTGRES_META,
  PostgresDataSource,
} from "@/wab/shared/data-sources-meta/postgres-meta";
import {
  SUPABASE_META,
  SupabaseDataSource,
} from "@/wab/shared/data-sources-meta/supabase-meta";
import {
  ZAPIER_META,
  ZapierDataSource,
} from "@/wab/shared/data-sources-meta/zapier-meta";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { DATA_SOURCE_LOWER } from "@/wab/shared/Labels";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import type { Fields } from "@/wab/shared/data-sources-meta/data-sources";
import { dataSourceQueryFields, getFieldOperators } from "@/wab/shared/query-builder";

export type GenericDataSource =
  | AirtableDataSource
  | HttpDataSource
  | GraphqlDataSource
  | SupabaseDataSource
  | PostgresDataSource
  | ZapierDataSource
  | FakeDataSource;

const DATA_SOURCE_METAS = {
  airtable: AIRTABLE_META,
  http: HTTP_META,
  graphql: GRAPHQL_META,
  supabase: SUPABASE_META,
  postgres: POSTGRES_META,
  zapier: ZAPIER_META,
  fake: FAKE_META,
} as const;

export type DataSourceType = keyof typeof DATA_SOURCE_METAS;

export function getDataSourceMeta(type: string): DataSourceMeta {
  return ensure(
    tryGetDataSourceMeta(type),
    () => `Unexpected ${DATA_SOURCE_LOWER} type ${type}`,
  );
}

/** For callers that can carry on without knowing the type, e.g. a stale tab. */
export function tryGetDataSourceMeta(type: string): DataSourceMeta | undefined {
  return DATA_SOURCE_METAS[type];
}

export function getAllPublicDataSourceMetas() {
  return getAllDataSourceMetas().filter(
    (meta) => !DEVFLAGS.hiddenDataSources.includes(meta.id),
  );
}

export function getAllDataSourceMetas() {
  return Object.values(DATA_SOURCE_METAS);
}

export function getAllDataSourceTypes() {
  return getAllDataSourceMetas().map((s) => s.id);
}

export function getDataSourceQueryBuilderConfig(type: string, fields: Fields): QueryBuilderConfig {
  return { fields: dataSourceQueryFields(fields).map((field) => ({ ...field, operators: getFieldOperators(field).filter((operator) =>
    operator.name !== "regex" && (type !== "airtable" || field.datatype === "number" || !["null", "notNull"].includes(operator.name)),
  ) })) };
}
