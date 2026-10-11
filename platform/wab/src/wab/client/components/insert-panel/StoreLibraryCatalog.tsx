import {
  groupStoreLibrarySections,
  StoreLibrary,
} from "@/wab/client/components/insert-panel/storeLibraries";
import { useI18n } from "@/wab/client/i18n";
import { RightOutlined, SearchOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Avatar, Button, Empty, Input, Select, Tag, Typography } from "antd";
import React from "react";

const sectionDescriptions = [
  {
    category: "Design systems",
    message: "Code components for common interface controls.",
  },
  {
    category: "UI kits",
    message: "Collections of reusable visual components.",
  },
  {
    category: "Business components",
    message: "Code components for product-specific features.",
  },
  { category: "Icons", message: "Icon components and assets." },
  {
    category: "Built-in components",
    message: "Show these components in Insert for this session.",
  },
] as const;

export function StoreLibraryCatalog({
  libraries,
  installedProjectIds,
  canEnable,
  onOpen,
  onEnable,
}: {
  libraries: StoreLibrary[];
  installedProjectIds: string[];
  canEnable: boolean;
  onOpen: (library: StoreLibrary) => void;
  onEnable: (library: StoreLibrary) => void;
}) {
  const { t, label } = useI18n();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("");
  const sections = groupStoreLibrarySections(libraries);
  const filtered = libraries.filter(
    (library) =>
      (!category ||
        (library.synthetic ? "Built-in components" : library.category) ===
          category) &&
      `${library.name} ${label(library.category)} ${library.synthetic ? t("Built-in components") : ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="resource-panel-content store-library-catalog">
      <div className="store-library-filters">
        <Input
          prefix={<SearchOutlined />}
          placeholder={t("Search libraries")}
          aria-label={t("Search libraries")}
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label={t("Library category")}
          value={category}
          onChange={setCategory}
          options={[
            { value: "", label: t("All libraries") },
            ...sections.map(({ category: value }) => ({
              value,
              label: label(value),
            })),
          ]}
        />
      </div>
      <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
        <div className="store-library-list">
          {groupStoreLibrarySections(filtered).map((section) => (
            <section
              className="store-library-section"
              key={section.category}
              aria-label={label(section.category)}
            >
              <div className="store-library-section-heading">
                <Typography.Text strong>
                  {label(section.category)}
                </Typography.Text>
                {sectionDescriptions
                  .filter(({ category: value }) => value === section.category)
                  .map(({ message }) => (
                    <Typography.Text type="secondary" key={message}>
                      {t(message)}
                    </Typography.Text>
                  ))}
              </div>
              {section.libraries.map((library) => (
                <div className="store-library-row" key={library.key}>
                  <button
                    className="store-library-open"
                    disabled={library.synthetic && !canEnable}
                    onClick={() =>
                      library.synthetic ? onEnable(library) : onOpen(library)
                    }
                  >
                    <Avatar
                      className="store-library-cover"
                      shape="square"
                      size={36}
                      src={library.imageUrl}
                    >
                      {library.name.charAt(0)}
                    </Avatar>
                    <span className="store-library-description">
                      <Typography.Text strong>
                        {library.synthetic ? label(library.name) : library.name}
                      </Typography.Text>
                      {library.synthetic && (
                        <Typography.Text type="secondary">
                          {label(library.category)}
                        </Typography.Text>
                      )}
                    </span>
                    {library.projectIds.some((id) =>
                      installedProjectIds.includes(id),
                    ) && <Tag>{t("Installed")}</Tag>}
                    {!library.synthetic && <RightOutlined aria-hidden />}
                  </button>
                  {library.synthetic && (
                    <Button
                      className="store-library-enable"
                      size="small"
                      disabled={!canEnable}
                      onClick={() => onEnable(library)}
                    >
                      {t("Show in Insert")}
                    </Button>
                  )}
                </div>
              ))}
            </section>
          ))}
          {!filtered.length && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("No matching libraries found")}
            />
          )}
        </div>
      </Scrollbar>
    </div>
  );
}
