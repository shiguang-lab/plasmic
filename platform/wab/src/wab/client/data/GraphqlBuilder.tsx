import Button from "@/wab/client/components/widgets/Button";
import { UiText } from "@/wab/client/i18n/UiText";
import { QUERY_BUILDER_PLUGIN } from "@graphiql/plugin-query-builder";
import "@graphiql/plugin-query-builder/style.css";
import { configureMonacoWorkers } from "@/wab/client/monaco-worker-url";
import { createGraphqlTransport } from "@/wab/client/data/graphql-transport";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import React, { useMemo, useState } from "react";

configureMonacoWorkers();

interface GraphiqlWithExplorerProps {
  defaultQuery?: string;
  defaultVariables?: string;
  url: string;
  headers?: Record<string, string>;
  method?: string;
  onSave?: (query: string, variables: string | undefined) => void;
  onCancel?: () => void;
}

export default function GraphiqlWithExplorer({
  defaultQuery,
  defaultVariables,
  url,
  headers,
  method = "POST",
  onSave,
  onCancel,
}: GraphiqlWithExplorerProps) {
  const transport = useMemo(
    () => createGraphqlTransport({ url, headers, method }),
    [url, headers, method],
  );
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [variables, setVariables] = useState(defaultVariables);
  return (
    <div className="fill-height flex-col">
      <Scrollbar
        className="studio-scrollbar standard-gql-ui"
        style={{ flex: 1, minHeight: 0 }}
      >
        <GraphiQL
          forcedTheme="light"
          transport={transport}
          initialQuery={defaultQuery ?? ""}
          onEditQuery={setQuery}
          onEditVariables={setVariables}
          isHeadersEditorEnabled={false}
          visiblePlugin={QUERY_BUILDER_PLUGIN.title}
          initialVariables={defaultVariables}
        />
      </Scrollbar>

      <div className="flex-no-shrink flex flex-right pv-lg ph-xlg bt-dim">
        <Button
          onClick={() => {
            onCancel?.();
          }}
        >
          <UiText message={"Cancel"} />
        </Button>
        <Button
          className={"ml-lg"}
          onClick={() => {
            onSave?.(query, variables);
          }}
          type={"primary"}
        >
          <UiText message={"Save"} />
        </Button>
      </div>
    </div>
  );
}
