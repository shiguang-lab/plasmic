import { CodeDisplay } from "@/wab/client/components/coding/CodeDisplay";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCodeQuickstartDisplayProps } from "@/wab/client/plasmic/plasmic_kit_code_display_and_onboarding/PlasmicCodeQuickstartDisplay";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Flex,
  Input,
  Select,
  Typography,
} from "antd";
import { createStyles } from "antd-style";
import copy from "copy-to-clipboard";
import * as React from "react";

interface CodeQuickstartDisplayProps extends DefaultCodeQuickstartDisplayProps {
  project: ApiProject;
  noComponents: boolean;
  subjectComponentInfo:
    { pathOrComponent: string; componentName: string } | undefined;
}

const frameworks: {
  value: string;
  label: string;
  platform?: "react" | "nextjs" | "gatsby" | "tanstack";
}[] = [
  { value: "react", label: "React", platform: "react" },
  { value: "nextjs", label: "Next.js", platform: "nextjs" },
  { value: "gatsby", label: "Gatsby", platform: "gatsby" },
  { value: "hydrogen", label: "Hydrogen", platform: "react" },
  { value: "remix", label: "Remix", platform: "react" },
  { value: "tanstack", label: "TanStack", platform: "tanstack" },
  { value: "js", label: "JavaScript" },
  { value: "php", label: "PHP" },
  { value: "rest", label: "REST API" },
  { value: "graphql", label: "GraphQL" },
];
const useCodeDeliveryStyles = createStyles(({ token }) => ({
  root: {
    padding: 16,
    minWidth: 0,
    width: "100%",
    color: token.colorText,
    background: token.colorBgContainer,
  },
  command: {
    minWidth: 0,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    "& pre": { maxWidth: "100%", overflowX: "auto", marginBottom: 12 },
  },
}));

const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const CodeQuickstartDisplay = React.forwardRef<
  HTMLDivElement,
  CodeQuickstartDisplayProps
>(function CodeQuickstartDisplay(
  { project, noComponents, subjectComponentInfo, className },
  ref,
) {
  const appCtx = useAppCtx();
  const { t } = useI18n();
  const { styles, cx } = useCodeDeliveryStyles();
  const available = frameworks.filter(
    (item) => !appCtx.appConfig.hiddenQuickstartPlatforms.includes(item.value),
  );
  const [selected, setSelected] = React.useState(
    () =>
      available.find((item) => item.value === "nextjs")?.value ??
      available[0]?.value,
  );
  const framework =
    available.find((item) => item.value === selected) ?? available[0];
  const [copyState, setCopyState] = React.useState<
    "copied" | "failed" | undefined
  >();
  const command = framework?.platform
    ? `npx @plasmicapp/cli auth --host ${shellQuote(window.location.origin)}\nnpx @plasmicapp/cli init --host ${shellQuote(window.location.origin)} --platform ${framework.platform}\nnpx @plasmicapp/cli sync --projects ${shellQuote(project.id)}`
    : "";
  const params = new URLSearchParams({
    projectId: project.id,
    noComponents: String(noComponents),
    apiToken: project.projectApiToken ?? "null",
    ...(subjectComponentInfo ?? {}),
  });

  return (
    <Flex vertical gap={20} ref={ref} className={cx(styles.root, className)}>
      <Descriptions
        size="small"
        column={1}
        items={[
          { key: "project", label: t("Project"), children: project.name },
          {
            key: "id",
            label: t("Project ID"),
            children: (
              <Typography.Text code copyable>
                {project.id}
              </Typography.Text>
            ),
          },
          ...(subjectComponentInfo
            ? [
                {
                  key: "page",
                  label: t("Page / component"),
                  children: subjectComponentInfo.componentName,
                },
              ]
            : []),
        ]}
      />
      {noComponents && (
        <Alert
          type="info"
          showIcon
          title={t("Create a page or component before exporting code")}
        />
      )}
      {project.projectApiToken && (
        <Flex vertical gap={8}>
          <Typography.Text strong>{t("Project token")}</Typography.Text>
          <Input.Password
            aria-label={t("Project token")}
            readOnly
            value={project.projectApiToken}
            autoComplete="off"
          />
        </Flex>
      )}
      {framework ? (
        <>
          <Flex vertical gap={8}>
            <Typography.Text strong>{t("Framework")}</Typography.Text>
            <Select
              aria-label={t("Framework")}
              value={framework.value}
              options={available}
              onChange={(value) => {
                setSelected(value);
                setCopyState(undefined);
              }}
            />
          </Flex>
          {framework.platform && (
            <section className={styles.command}>
              <Typography.Title level={5}>
                {t("Sync source code")}
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                {t(
                  "Run these commands inside your application to initialize Plasmic for the selected framework and sync this project into your codebase.",
                )}
              </Typography.Paragraph>
              <CodeDisplay language="bash">{command}</CodeDisplay>
              <Button
                disabled={noComponents}
                onClick={() =>
                  setCopyState(copy(command) ? "copied" : "failed")
                }
              >
                {t("Copy command")}
              </Button>
              {copyState && (
                <Typography.Paragraph
                  role="status"
                  type={copyState === "failed" ? "danger" : "success"}
                >
                  {t(
                    copyState === "failed"
                      ? "Failed to copy command"
                      : "Command copied",
                  )}
                </Typography.Paragraph>
              )}
            </section>
          )}
          <Flex wrap gap={12}>
            <Button
              href={APP_ROUTES.projectDocsCodegenType.fill({
                projectId: project.id,
                codegenType: framework.platform ? "codegen" : "loader",
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Open API explorer")}
            </Button>
            <Button
              href={`${appCtx.appConfig.appContentBaseUrl}/${framework.value}#${params.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Open integration guide")}
            </Button>
          </Flex>
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("No integration frameworks available")}
        />
      )}
    </Flex>
  );
});
export default CodeQuickstartDisplay;
