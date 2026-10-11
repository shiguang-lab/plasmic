import AnalyticsHeader from "@/wab/client/components/analytics/AnalyticsHeader";
import { ANALYTICS_EVENTS } from "@/wab/client/components/analytics/utils";
import { CmsLoadingShell } from "@/wab/client/components/cms/CmsLoading";
import { DashboardLayout } from "@/wab/client/components/dashboard/DashboardLayout";
import { DashboardPageLoading } from "@/wab/client/components/dashboard/DashboardPageLoading";
import { NormalLayoutLoading } from "@/wab/client/components/normal-layout";
import { IntakeFlowForm } from "@/wab/client/components/pages/IntakeFlowForm";
import {
  ChartSkeleton,
  FormSkeleton,
  RowsSkeleton,
} from "@/wab/client/components/widgets/ContentSkeletons";
import { useI18n } from "@/wab/client/i18n";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { usesProductTheme } from "@/wab/client/ui-theme";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Select,
  Skeleton,
  Typography,
} from "antd";
import dayjs from "dayjs";
import * as React from "react";

export function ApplicationPageLoading() {
  const { pathname, search } = useLocation();
  const { t } = useI18n();
  const params = new URLSearchParams(search);
  if (APP_ROUTES.login.parse(pathname) || APP_ROUTES.register.parse(pathname)) {
    return (
      <IntakeFlowForm>
        <Button
          type="primary"
          href={getShiguangSignInUrl(window.location.href)}
        >
          {t("Sign in with Shiguang")}
        </Button>
      </IntakeFlowForm>
    );
  }
  if (APP_ROUTES.orgCreation.parse(pathname)) {
    return (
      <IntakeFlowForm>
        <Form layout="vertical" className="SurveyForm__Fields">
          <h2>{t("Welcome to Plasmic!")}</h2>
          <Form.Item label={t("Tell us about your organization")}>
            <Input disabled size="large" />
          </Form.Item>
          <Button disabled type="primary" size="large">
            {t("Name this organization")}
          </Button>
        </Form>
      </IntakeFlowForm>
    );
  }
  if (!usesProductTheme(pathname)) {
    return (
      <IntakeFlowForm>
        <FormSkeleton />
      </IntakeFlowForm>
    );
  }
  if (APP_ROUTES.cmsRoot.parse(pathname, false)) {
    return <CmsLoadingShell />;
  }
  const analytics = APP_ROUTES.orgAnalytics.parse(pathname);
  if (analytics) {
    return (
      <Flex vertical gap={24} style={{ padding: 24 }}>
        <AnalyticsHeader teamId={analytics.teamId} />
        <Flex
          vertical
          gap={24}
          style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}
        >
          <Flex wrap gap={16}>
            {(
              [
                ["Project", "All projects", "projectId"],
                ["Page / component", "All pages and components", "componentId"],
                ["Optimization", "All optimizations", "splitId"],
              ] as const
            ).map(([label, placeholder, param]) => (
              <Flex
                key={label}
                vertical
                gap={4}
                style={{ minWidth: 180, flex: 1 }}
              >
                <Typography.Text>{t(label)}</Typography.Text>
                <Select
                  disabled
                  placeholder={
                    params.get(param) ? (
                      <Skeleton.Input
                        active
                        size="small"
                        style={{ height: 14, width: 80, minWidth: 80 }}
                      />
                    ) : (
                      t(placeholder)
                    )
                  }
                />
              </Flex>
            ))}
          </Flex>
          <Flex wrap gap={16} align="end">
            <Flex vertical gap={4}>
              <Typography.Text>{t("Time Range")}</Typography.Text>
              <DatePicker.RangePicker
                disabled
                value={[
                  dayjs(
                    params.get("from") ??
                      dayjs().subtract(1, "month").startOf("month"),
                  ),
                  dayjs(params.get("to") ?? dayjs()),
                ]}
              />
            </Flex>
            <Flex vertical gap={4} style={{ minWidth: 160 }}>
              <Typography.Text>{t("Metric")}</Typography.Text>
              <Select
                disabled
                value={params.get("event") ?? "impressions"}
                options={ANALYTICS_EVENTS.map((item) => ({
                  value: item.value,
                  label: t(item.label),
                }))}
              />
            </Flex>
            <Flex vertical gap={4} style={{ minWidth: 140 }}>
              <Typography.Text>{t("Period")}</Typography.Text>
              <Select
                disabled
                value={params.get("period") ?? "day"}
                options={[
                  { value: "day", label: t("Daily") },
                  { value: "month", label: t("Monthly") },
                ]}
              />
            </Flex>
            <Button disabled>{t("Share")}</Button>
            <Button disabled>{t("Export CSV")}</Button>
          </Flex>
          <Card role="status" aria-label={t("Loading analytics…")}>
            <ChartSkeleton />
          </Card>
        </Flex>
      </Flex>
    );
  }
  if (
    pathname.startsWith("/admin") ||
    APP_ROUTES.importProjectsFromProd.parse(pathname)
  ) {
    return (
      <NormalLayoutLoading>
        <RowsSkeleton rows={6} avatar />
      </NormalLayoutLoading>
    );
  }
  return (
    <DashboardLayout>
      <DashboardPageLoading />
    </DashboardLayout>
  );
}
