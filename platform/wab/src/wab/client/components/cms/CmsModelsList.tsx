import ListSection from "@/wab/client/components/ListSection";
import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import CmsModelItem from "@/wab/client/components/cms/CmsModelItem";
import {
  useCmsDatabase,
  useMutateTables,
} from "@/wab/client/components/cms/cms-contexts";
import { reactPrompt } from "@/wab/client/components/quick-modals";
import { Matcher } from "@/wab/client/components/view-common";
import IconButton from "@/wab/client/components/widgets/IconButton";
import Searchbox from "@/wab/client/components/widgets/Searchbox";
import { useApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCmsModelsListProps } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsModelsList";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { useMatchedRoute } from "@/wab/client/route/useMatchedRoute";
import { CmsDatabaseId, CmsTableId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { partition, sortBy } from "lodash";
import * as React from "react";

export type CmsModelsListProps = DefaultCmsModelsListProps;

export const CmsModelsListLayout = React.forwardRef<
  HTMLDivElement,
  CmsModelsListProps & {
    searchInput: React.ComponentProps<typeof Searchbox>;
    addAction?: React.ReactNode;
    collapsedState?: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  }
>(function CmsModelsListLayout(
  {
    className,
    isSchemaMode,
    isEmpty,
    searchInput,
    addAction,
    children,
    archivedModels,
    collapsedState,
  },
  ref,
) {
  const { styles, cx } = useCmsLayoutStyles();
  const { t } = useI18n();
  return (
    <div ref={ref} className={cx(className, styles.models)}>
      <div className={styles.modelsHeader}>
        {t(isSchemaMode ? "Edit Models" : "Models")}
        {isSchemaMode && addAction}
      </div>
      <Searchbox placeholder={t("Filter...")} {...searchInput} />
      <Scrollbar scrollX={false} className={styles.entryList}>
        <div className={styles.modelItems}>
          {isEmpty ? t("No models have been created.") : children}
          {archivedModels && (
            <ListSection
              title={t("Archived models")}
              isCollapsible
              collapsedState={collapsedState}
              isLast
            >
              <div className={styles.modelItems}>{archivedModels}</div>
            </ListSection>
          )}
        </div>
      </Scrollbar>
    </div>
  );
});

function CmsModelsList_(
  props: CmsModelsListProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { t: studioUiT } = useI18n();

  const match = useMatchedRoute<{
    databaseId: CmsDatabaseId;
    tableId?: CmsTableId;
  }>()!;
  const { databaseId, tableId } = match.pathParams;
  const { database } = useCmsDatabase(databaseId);
  const api = useApi();
  const mutateTables = useMutateTables();
  const history = useHistory();
  const [query, setQuery] = React.useState("");
  const matcher = new Matcher(query);
  const tables = database ? sortBy(database.tables, (table) => table.name) : [];
  const searchFilterTables = tables.filter(
    (t) => matcher.matches(t.name) || matcher.matches(t.identifier),
  );
  const [filteredTables, archivedTables] = partition(
    searchFilterTables,
    (t) => !t.isArchived,
  );
  const collapsedState = React.useState(
    tableId && archivedTables.some((t) => t.id === tableId) ? false : true,
  );
  return (
    <CmsModelsListLayout
      {...props}
      ref={ref}
      searchInput={{
        value: query,
        onChange: (e) => setQuery(e.target.value),
      }}
      children={
        <>
          {filteredTables.map((table) => (
            <CmsModelItem key={table.id} table={table} matcher={matcher} />
          ))}
        </>
      }
      addAction={
        <IconButton
          withBackgroundHover
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={async () => {
            const name = await reactPrompt({
              message: studioUiT("Enter the name for your new CMS table"),
              placeholder: studioUiT("Table name"),
              actionText: studioUiT("Add"),
            });
            if (!name) {
              return;
            }
            const table = await api.createCmsTable(databaseId, {
              name,
              identifier: name,
            });
            await mutateTables(databaseId);
            history.push(
              APP_ROUTES.cmsModelSchema.fill({
                databaseId,
                tableId: table.id,
              }),
            );
          }}
          data-test-id="addModelButton"
        />
      }
      collapsedState={collapsedState}
      archivedModels={
        archivedTables.length > 0 && (
          <>
            {archivedTables.map((table) => (
              <CmsModelItem key={table.id} table={table} matcher={matcher} />
            ))}
          </>
        )
      }
    />
  );
}

const CmsModelsList = React.forwardRef(CmsModelsList_);
export default CmsModelsList;
