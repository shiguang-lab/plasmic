import { Modal } from "@/wab/client/components/widgets/Modal";
import {
  useAllProjectsData,
  useAppCtx,
} from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { ProjectId, WorkspaceId } from "@/wab/shared/ApiSchema";
import { updateExtraDataJson } from "@/wab/shared/ApiSchemaUtil";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { ensure } from "@/wab/shared/common";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { StarterProjectConfig } from "@/wab/shared/devflags";
import { getAccessLevelToResource } from "@/wab/shared/perms";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
} from "antd";
import { createStyles } from "antd-style";
import { union, uniqBy } from "lodash";
import { observer } from "mobx-react";
import * as React from "react";

interface NewProjectModalProps {
  onCancel: () => void;
  workspaceId?: WorkspaceId;
}

const useStyles = createStyles(({ token }) => ({
  templates: { maxHeight: "min(420px, 45vh)", overflowY: "auto", padding: 2 },
  card: { height: "100%", cursor: "pointer", borderColor: token.colorBorder },
  selected: {
    borderColor: token.colorPrimary,
    background: token.colorPrimaryBg,
  },
  image: {
    width: "100%",
    height: 110,
    objectFit: "cover",
    borderRadius: token.borderRadius,
  },
}));

const NewProjectModal = observer(function NewProjectModal({
  workspaceId,
  onCancel,
}: NewProjectModalProps) {
  const { t } = useI18n();
  const appCtx = useAppCtx();
  const history = useHistory();
  const {
    data: projectsData,
    error: loadError,
    mutate: reloadProjects,
  } = useAllProjectsData();
  const { styles, cx } = useStyles();
  const [form] = Form.useForm<{ name: string; workspaceId?: WorkspaceId }>();
  const [startingPoint, setStartingPoint] = React.useState("blank");
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<StarterProjectConfig>();
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const showInternal = isAdminTeamEmail(
    appCtx.selfInfo?.email,
    appCtx.appConfig,
  );
  const destination = Form.useWatch("workspaceId", form);
  const workspaces = appCtx.workspaces.filter(
    (workspace) =>
      projectsData &&
      accessLevelRank(
        getAccessLevelToResource(
          { type: "workspace", resource: workspace },
          appCtx.selfInfo,
          projectsData.perms,
        ),
      ) >= accessLevelRank("editor"),
  );
  const templates = uniqBy(
    [
      ...(projectsData?.projects ?? [])
        .filter(
          (project) =>
            project.workspaceId === destination && project.isUserStarter,
        )
        .map((project): StarterProjectConfig => ({
          name: project.name,
          projectId: project.id,
          tag: project.id,
          description: "",
        })),
      ...[
        ...appCtx.starters.templateAndExampleSections,
        ...appCtx.starters.appSections,
      ]
        .flatMap((section) => section.projects)
        .filter((starter) => !starter.isPlasmicOnly || showInternal),
    ],
    (starter) => starter.tag,
  ).filter((starter) => starter.projectId || starter.baseProjectId);

  React.useEffect(() => {
    if (
      selectedTemplate &&
      !templates.some((template) => template.tag === selectedTemplate.tag)
    ) {
      setSelectedTemplate(undefined);
    }
  }, [destination]);

  const create = async (values: {
    name: string;
    workspaceId?: WorkspaceId;
  }) => {
    if (startingPoint === "template" && !selectedTemplate) {
      return;
    }
    setCreating(true);
    setError(undefined);
    try {
      let projectId: ProjectId;
      if (startingPoint === "template" && selectedTemplate) {
        await appCtx.api.updateUserPreferences(
          updateExtraDataJson(ensure(appCtx.selfInfo, "Must be logged in"), {
            starterProgress: (previous) =>
              union(previous, [selectedTemplate.tag]),
          }),
        );
        const result = selectedTemplate.projectId
          ? await appCtx.api.cloneProject(selectedTemplate.projectId, {
              name: values.name.trim(),
              workspaceId: values.workspaceId,
            })
          : await appCtx.api.clonePublishedTemplate(
              ensure(
                selectedTemplate.baseProjectId,
                "Template must have a project",
              ),
              values.name.trim(),
              values.workspaceId,
            );
        projectId = result.projectId;
        // Template imports may change code libraries; load the resulting editor afresh.
        window.location.href = APP_ROUTES.project.fill({ projectId });
      } else {
        const { project } = await appCtx.api.createProject({
          name: values.name.trim(),
          workspaceId: values.workspaceId,
        });
        projectId = project.id;
        history.push(APP_ROUTES.project.fill({ projectId }));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Failed to create project"),
      );
      setCreating(false);
    }
  };

  return (
    <Modal
      open
      title={t("New project")}
      width={760}
      onCancel={onCancel}
      closable={!creating}
      maskClosable={!creating}
      keyboard={!creating}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={creating}>
            {t("Cancel")}
          </Button>
          <Button
            type="primary"
            loading={creating}
            disabled={
              !projectsData ||
              !workspaces.some((workspace) => workspace.id === destination) ||
              (startingPoint === "template" && !selectedTemplate)
            }
            onClick={() => form.submit()}
          >
            {t("Create")}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        onFinish={create}
        layout="vertical"
        initialValues={{
          workspaceId: workspaceId ?? appCtx.personalWorkspace?.id,
        }}
        disabled={creating}
      >
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item
              name="name"
              label={t("Name")}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: t("Enter a project name"),
                },
              ]}
            >
              <Input autoFocus maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item
              name="workspaceId"
              label={t("Workspace")}
              rules={[{ required: true }]}
            >
              <Select
                loading={!projectsData}
                options={workspaces.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {loadError && (
        <Alert
          type="error"
          showIcon
          title={t("Failed to load projects")}
          action={
            <Button
              size="small"
              onClick={() => {
                void reloadProjects();
              }}
            >
              {t("Retry")}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Tabs
        activeKey={startingPoint}
        onChange={(key) => {
          if (!creating) {
            setStartingPoint(key);
          }
        }}
        items={[
          {
            key: "blank",
            label: t("Blank project"),
            children: (
              <Typography.Paragraph type="secondary">
                {t("Start with an empty canvas.")}
              </Typography.Paragraph>
            ),
          },
          {
            key: "template",
            label: t("Templates"),
            children: (
              <div className={styles.templates}>
                {templates.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("No templates available in this workspace.")}
                  />
                ) : (
                  <Radio.Group
                    value={selectedTemplate?.tag}
                    style={{ width: "100%" }}
                    onChange={(event) =>
                      setSelectedTemplate(
                        templates.find(
                          (template) => template.tag === event.target.value,
                        ),
                      )
                    }
                    disabled={creating}
                  >
                    <Row gutter={[12, 12]}>
                      {templates.map((template) => (
                        <Col xs={24} sm={12} key={template.tag}>
                          <Card
                            className={cx(
                              styles.card,
                              selectedTemplate?.tag === template.tag &&
                                styles.selected,
                            )}
                            onClick={() => {
                              if (!creating) {
                                setSelectedTemplate(template);
                              }
                            }}
                          >
                            {template.imageUrl && (
                              <img
                                className={styles.image}
                                src={template.imageUrl}
                                alt=""
                              />
                            )}
                            <Radio value={template.tag}>{template.name}</Radio>
                            <Typography.Paragraph
                              type="secondary"
                              ellipsis={{ rows: 2 }}
                              style={{ marginTop: 8, marginBottom: 0 }}
                            >
                              {template.description}
                            </Typography.Paragraph>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Radio.Group>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
});

export default NewProjectModal;
