import { useI18n } from "@/wab/client/i18n";
import { Input, Select, Space } from "antd";
import * as React from "react";

export interface ProjectsFilterProps {
  query: string;
  setQuery: (query: string) => void;
  orderBy: string;
  setOrderBy: (orderBy: string | null) => void;
  disabled?: boolean;
}

const ProjectsFilter = React.forwardRef<HTMLDivElement, ProjectsFilterProps>(
  function ProjectsFilter({ query, setQuery, orderBy, setOrderBy, disabled }, ref) {
    const { t } = useI18n();
    return (
      <div ref={ref}>
        <Space wrap>
          <Input.Search
            disabled={disabled}
            aria-label={t("Search…")}
            placeholder={t("Search…")}
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 240, maxWidth: "100%" }}
          />
          <Select
            disabled={disabled}
            aria-label={t("Order by")}
            value={orderBy}
            onChange={setOrderBy}
            style={{ minWidth: 150 }}
            options={[
              { value: "updatedAt", label: t("Last modified") },
              { value: "name", label: t("Alphabetically") },
            ]}
          />
        </Space>
      </div>
    );
  },
);
export default ProjectsFilter;
