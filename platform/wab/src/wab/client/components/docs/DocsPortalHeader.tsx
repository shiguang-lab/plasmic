import { PublicLink } from "@/wab/client/components/PublicLink";
import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { showTemporaryInfo } from "@/wab/client/components/quick-modals";
import Select from "@/wab/client/components/widgets/Select";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultDocsPortalHeaderProps,
  PlasmicDocsPortalHeader,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortalHeader";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { asOne } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import * as React from "react";
import { useStore } from "zustand";

type DocsPortalHeaderProps = DefaultDocsPortalHeaderProps;

const CodegenTypes = [
  <Select.Option value="loader" key="loader">
    Loader
  </Select.Option>,
  <Select.Option value="codegen" key="codegen">
    Codegen
  </Select.Option>,
];

function DocsPortalHeader(props: DocsPortalHeaderProps) {
  const { t: uiT } = useI18n();
  const history = useHistory();
  const docsCtx = useDocsPortalCtx();
  const projectId = useStore(docsCtx.studioCtx.projectMetadataStore, (state) => state.id);
  const codegenType = useStore(docsCtx.store, (state) => state.codegenType);
  return (
    <>
      <PlasmicDocsPortalHeader
        {...props}
        studioButton={{
          render: (ps) => {
            const { ref: _ref, children, ...rest } = ps;
            return (
              <PublicLink
                {...rest}
                href={APP_ROUTES.project.fill({
                  projectId,
                })}
                children={asOne(children)}
              />
            );
          },
        }}
        projectTokenButton={{
          render: (ps, Comp) =>
            codegenType === "loader" ? (
              <Comp
                {...ps}
                onClick={async () => {
                  await showTemporaryInfo({
                    title: uiT("Project token"),
                    content: (
                      <code>{docsCtx.studioCtx.siteInfo.projectApiToken}</code>
                    ),
                  });
                }}
              />
            ) : null,
        }}
        codegenType={{
          "aria-label": uiT("Codegen Type"),
          value: codegenType,
          onChange(newCodegenType) {
            if (newCodegenType !== "codegen" && newCodegenType !== "loader") {
              return;
            }

            const location = history.location;
                      const oldCodegenType = docsCtx.getCodegenType();
            const newPathname = location.pathname.replace(
              APP_ROUTES.projectDocsCodegenType.fill({
                projectId,
                codegenType: oldCodegenType,
              }),
              APP_ROUTES.projectDocsCodegenType.fill({
                projectId,
                codegenType: newCodegenType,
              }),
            );
            history.push({
              pathname: newPathname,
              search: location.search,
              hash: location.hash,
            });
          },
          children: CodegenTypes,
        }}
      />
    </>
  );
}

export default DocsPortalHeader;
