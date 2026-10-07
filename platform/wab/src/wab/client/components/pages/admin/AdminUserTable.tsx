import { smartRender } from "@/wab/client/components/pages/admin/admin-util";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { SearchBox } from "@/wab/client/components/widgets";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { Table, TableProps } from "antd";
import L from "lodash";
import * as React from "react";
import { useMemo, useState } from "react";

interface Item {
  user: ApiUser;
}

export interface AdminUserTableProps<T extends Item> {
  items: T[];
  extraColumns?: TableProps<T>["columns"];
}

export function AdminUserTable<T extends Item = Item>({
  items,
  extraColumns = [],
}: AdminUserTableProps<T>) {
  const [filter, setFilter] = useState<string>("");
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!filter || filter.trim().length === 0) {
        return true;
      }
      const q = filter.toLowerCase();
      return (
        item.user.email?.toLowerCase().includes(q) ||
        item.user.displayName?.toLowerCase().includes(q)
      );
    });
  }, [items, filter]);

  return (
    <div>
      <SearchBox value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table<T>
        dataSource={filteredItems}
        rowKey={"id"}
        columns={[
          {
            title: "",
            key: "avatar",
            render: (_value, item) => <Avatar user={item.user} />,
          },
          ...["email", "displayName", "state"].map((key) => ({
            key,
            dataIndex: ["user", key],
            title: L.startCase(key),
            render: smartRender,
            sorter: (a, b) => (a.user[key] < b.user[key] ? -1 : 1),
            ...(key === "email" ? { defaultSortOrder: "ascend" as const } : {}),
          })),
          ...extraColumns,
        ]}
      />
    </div>
  );
}
