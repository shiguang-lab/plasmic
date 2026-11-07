import { QueryBuilder } from "@graphiql/plugin-query-builder";
import { DocExplorer, DocExplorerStore } from "@graphiql/plugin-doc-explorer";
import React from "react";

export function GqlComponents() {
  return <QueryBuilder />;
}

export function GqlDoc() {
  return <DocExplorerStore><DocExplorer /></DocExplorerStore>;
}
