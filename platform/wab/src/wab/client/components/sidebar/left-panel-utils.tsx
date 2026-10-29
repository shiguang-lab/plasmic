import { UiText } from "@/wab/client/i18n/UiText";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import { without } from "lodash";
import React from "react";

export function useDepFilterButton(opts: {
  studioCtx: StudioCtx;
  deps: ProjectDependency[];
}) {
  const { t } = useI18n();
  const { studioCtx, deps } = opts;
  const [filterDeps, setFilterDeps] = React.useState<ProjectDependency[]>([]);

  return {
    filterDeps,
    filterProps:
      deps.length === 0
        ? {
            render: () => null,
          }
        : {
            tooltip:
              filterDeps.length === 0
                ? t("Filter by imported projects")
                : t("Filtering by: {projects}", { projects: filterDeps
                    .map(
                      (d) =>
                        `"${studioCtx.projectDependencyManager.getNiceDepName(
                          d,
                        )}"`,
                    )
                    .join(", ") }),
            popupRender: () => {
              return (
                <Menu selectedKeys={filterDeps.map((d) => d.uuid)}>
                  {deps.map((dep) => (
                    <Menu.Item
                      key={dep.uuid}
                      onClick={() => {
                        if (filterDeps.includes(dep)) {
                          setFilterDeps(without(filterDeps, dep));
                        } else {
                          setFilterDeps([...filterDeps, dep]);
                        }
                      }}
                    >
                      {studioCtx.projectDependencyManager.getNiceDepName(dep)}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Item key="clear" onClick={() => setFilterDeps([])}>
                    <UiText message={"Clear filter"} />
                  </Menu.Item>
                </Menu>
              );
            },
            isActive: filterDeps.length > 0,
          },
  };
}
