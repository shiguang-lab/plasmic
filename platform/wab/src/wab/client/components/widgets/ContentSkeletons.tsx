import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { Flex, Skeleton } from "antd";
import { FolderOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";
import * as React from "react";

const useSkeletonStyles = createStyles(({ token }) => ({
  card: {
    cursor: "default",
    pointerEvents: "none",
    background: token.colorBgContainer,
    borderColor: token.colorBorderSecondary,
  },
  thumbnail: {
    background: token.colorFillSecondary,
  },
  line: {
    width: "100%",
    flex: 1,
    minWidth: 0,
    "& .ant-skeleton-input": { width: "100%", height: 14, minWidth: 0 },
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 0",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  fields: { display: "flex", flexDirection: "column", gap: 20, padding: 24 },
  chart: {
    height: 360,
    display: "flex",
    alignItems: "flex-end",
    gap: "4%",
    padding: "24px 32px",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  bar: {
    flex: 1,
    background: token.colorFillSecondary,
    borderRadius: "6px 6px 0 0",
  },
}));

export function PillSkeleton({
  width = 112,
  height = 36,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Skeleton.Button
      active
      shape="round"
      style={{ width, height, minWidth: width }}
    />
  );
}

export function ProjectCardsSkeleton({ view = "grid", showWorkspace = false }: { view?: string; showWorkspace?: boolean }) {
  const { t } = useI18n();
  const { styles: layout, cx } = useProjectBrowserStyles();
  const { styles } = useSkeletonStyles();
  return (
    <div
      className={cx(layout.grid, view === "list" && layout.list)}
      role="status"
      aria-label={t("Loading projects…")}
    >
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className={cx(dashboard.projectCard, styles.card)}
          aria-hidden="true"
        >
          <div className={cx(dashboard.thumbnail, styles.thumbnail)} />
          <div className={dashboard.content}>
            <div className={dashboard.header}>
              <Skeleton.Input
                active
                size="small"
                className={styles.line}
                style={{ height: 14, width: "100%" }}
              />
              <Skeleton.Button active size="small" style={{ width: 28, minWidth: 28, height: 28 }} />
            </div>
            <Flex
              align="center"
              justify="space-between"
              className={dashboard.meta}
            >
              <Skeleton.Input active size="small" style={{ width: 136, minWidth: 0, height: 14 }} />
              {showWorkspace && <Skeleton.Input active size="small" style={{ width: 80, minWidth: 80, height: 22 }} />}
            </Flex>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectGroupsSkeleton({ view = "grid" }: { view?: string }) {
  return (
    <div className={dashboard.projectBrowser}>
      <div className={dashboard.projectLibrary}>
        <section className={dashboard.projectGroup}>
          <div className={dashboard.groupHeading} aria-hidden="true">
            <FolderOutlined />
            <Skeleton.Input active size="small" style={{ width: 140, height: 22 }} />
            <Skeleton.Input active size="small" style={{ width: 24, minWidth: 24, height: 14 }} />
          </div>
          <ProjectCardsSkeleton view={view} showWorkspace />
        </section>
      </div>
    </div>
  );
}

export function RowsSkeleton({
  rows = 3,
  avatar = false,
}: {
  rows?: number;
  avatar?: boolean;
}) {
  const { styles } = useSkeletonStyles();
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, key) => (
        <div key={key} className={styles.row}>
          {avatar && <Skeleton.Avatar active size={32} />}
          <Skeleton.Input
            active
            size="small"
            className={styles.line}
            style={{ height: 14, width: "100%" }}
          />
          <PillSkeleton width={80} height={32} />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ labels }: { labels?: string[] }) {
  const { styles } = useSkeletonStyles();
  return (
    <div className={styles.fields}>
      {(labels ?? [undefined, undefined, undefined]).map((label, key) => (
        <Flex key={key} vertical gap={8}>
          {label ? (
            <span>{label}</span>
          ) : (
            <Skeleton.Input
              active
              size="small"
              style={{ width: 120, height: 14 }}
            />
          )}
          <Skeleton.Input active block style={{ height: 36 }} />
        </Flex>
      ))}
      <PillSkeleton />
    </div>
  );
}

export function ChartSkeleton() {
  const { styles } = useSkeletonStyles();
  return (
    <div className={styles.chart} aria-hidden="true">
      {[40, 65, 50, 80, 60, 90].map((height, key) => (
        <div
          key={key}
          className={styles.bar}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}
