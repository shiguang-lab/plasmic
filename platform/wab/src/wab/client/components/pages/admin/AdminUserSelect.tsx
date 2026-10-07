import { useNonAuthCtx } from "@/wab/client/app-ctx";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { Select } from "antd";
import React, { useEffect, useState } from "react";

export interface AdminUserSelectProps {
  onChange: (userId: string) => void;
}
export function AdminUserSelect({ onChange }: AdminUserSelectProps) {
  const { api } = useNonAuthCtx();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 3) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.searchIdentities(query.trim());
        if (!cancelled) {
          setUsers(result.users);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, query]);
  return (
    <Select
      style={{ width: 400 }}
      showSearch
      filterOption={false}
      loading={loading}
      placeholder="Search Shiguang users (3+ characters)"
      onSearch={setQuery}
      options={users.map((user) => ({
        value: user.id,
        label: `${user.displayName} (${user.email})`,
      }))}
      onChange={onChange}
    />
  );
}
