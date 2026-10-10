import { useApi } from "@/wab/client/contexts/AppContexts";
import {
  ApiCmseRow,
  CmsDatabaseId,
  CmsMetaType,
  CmsRowId,
  CmsRowRevisionId,
  CmsTableId,
} from "@/wab/shared/ApiSchema";
import { spawn } from "@/wab/shared/common";
import useSWR, { useSWRConfig } from "swr";

export function useCmsDatabase(databaseId: CmsDatabaseId | undefined) {
  const api = useApi();
  const {
    data: database,
    error,
    mutate,
  } = useSWR(
    databaseId ? `/cmse/databases/${databaseId}` : undefined,
    async () => api.getCmsDatabase(databaseId!, true),
  );
  return { database, error, mutate };
}

export function useCmsTableMaybe(
  databaseId: CmsDatabaseId,
  tableId?: CmsTableId,
) {
  const { database: db } = useCmsDatabase(databaseId);
  if (!db || !tableId) {
    return undefined;
  }
  return { table: db.tables.find((t) => t.id === tableId) };
}

export function useCmsTable(databaseId: CmsDatabaseId, tableId?: CmsTableId) {
  return useCmsTableMaybe(databaseId, tableId)?.table;
}

export function useCmsRows(databaseId: CmsDatabaseId, tableId?: CmsTableId) {
  const table = useCmsTable(databaseId, tableId);
  const api = useApi();
  const {
    data: rows,
    error,
    mutate,
  } = useSWR(table ? `/cmse/tables/${tableId}/rows` : undefined, async () => {
    if (!table) {
      return [];
    }
    const firstTextField = table.schema.fields.find((field, _) =>
      [CmsMetaType.TEXT, CmsMetaType.LONG_TEXT].includes(field.type),
    )?.identifier;
    return await api.listCmsRows(
      table.id,
      firstTextField ? [firstTextField] : [],
    );
  });
  return { rows, error, mutate };
}

export function useCmsRow(tableId: CmsTableId, rowId: CmsRowId) {
  const api = useApi();
  const {
    data: row,
    error,
    mutate,
  } = useSWR(`/cmse/rows/${rowId}`, async () => {
    return await api.getCmsRow(rowId);
  });
  return { row, error, mutate };
}

export function useCmsRowHistory(rowId: CmsRowId) {
  const api = useApi();
  const {
    data: revisions,
    error,
    mutate,
  } = useSWR(`/cmse/rows/${rowId}/revisions`, async () => {
    return await api.listCmsRowRevisions(rowId);
  });
  return { revisions, error, mutate };
}

export function useCmsRowRevision(
  rowId: CmsRowId,
  revisionId: CmsRowRevisionId,
) {
  const api = useApi();
  const {
    data: revision,
    error,
    mutate,
  } = useSWR(`/cmse/row-revisions/${revisionId}`, async () => {
    return await api.getCmsRowRevision(revisionId);
  });
  return { revision, error, mutate };
}

export function useMutateDatabase() {
  const { mutate } = useSWRConfig();
  return async (databaseId: CmsDatabaseId) => {
    await mutate(`/cmse/databases/${databaseId}`);
  };
}

export function useMutateRow() {
  const { mutate } = useSWRConfig();
  return async (tableId: CmsTableId, rowId: CmsRowId) => {
    const newRow = (await mutate(`/cmse/rows/${rowId}`)) as ApiCmseRow;
    spawn(mutate(`/cmse/tables/${tableId}/rows`));
    spawn(mutate(`/cmse/rows/${rowId}/revisions`));
    return newRow;
  };
}

export function useMutateTables() {
  const { mutate } = useSWRConfig();
  return async (databaseId: CmsDatabaseId) => {
    await mutate(`/cmse/databases/${databaseId}`);
  };
}

export function useMutateTable() {
  const { mutate } = useSWRConfig();
  return async (databaseId: CmsDatabaseId, tableId: CmsTableId) => {
    await mutate(`/cmse/databases/${databaseId}`);
  };
}

export function useMutateTableRows() {
  const { mutate } = useSWRConfig();
  return async (tableId: CmsTableId) => {
    await mutate(`/cmse/tables/${tableId}/rows`);
  };
}
