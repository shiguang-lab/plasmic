import { PublicLink } from "@/wab/client/components/PublicLink";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import type {
  ApiDesignTemplate,
  TemplateMetadata,
  TemplatePublication,
} from "@/wab/shared/template-center";
import { LayoutOutlined, PlusOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  Typography,
  message,
} from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import useSWR from "swr";

const useStyles = createStyles(({ token }) => ({
  root: { padding: 24, display: "flex", flexDirection: "column", gap: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  cover: {
    height: 160,
    width: "100%",
    objectFit: "contain",
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
  },
  placeholder: {
    height: 160,
    display: "grid",
    placeItems: "center",
    fontSize: 40,
    background: token.colorFillAlter,
    color: token.colorTextTertiary,
  },
  formScroll: { maxHeight: "65vh", minHeight: 0 },
  preview: {
    height: "70vh",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    overflow: "hidden",
    background: token.colorFillAlter,
  },
  frame: { height: "100%", border: 0, background: "white", maxWidth: "100%" },
}));

const emptyDraft: TemplateMetadata = {
  name: "",
  description: "",
  kind: "page",
  device: "mobile",
  category: "",
  thumbnailUrl: "",
};

export default function TemplateCenter() {
  const appCtx = useAppCtx();
  const history = useHistory();
  const { t } = useI18n();
  const { styles } = useStyles();
  const { data, error, mutate, isValidating } = useSWR(
    ["template-center", appCtx.selfInfo?.id],
    () => appCtx.api.listDesignTemplates(),
  );
  const [search, setSearch] = React.useState("");
  const [kind, setKind] = React.useState("all");
  const [device, setDevice] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [library, setLibrary] = React.useState("all");
  const [editing, setEditing] = React.useState<ApiDesignTemplate | "new">();
  const [preview, setPreview] = React.useState<TemplatePublication>();
  const [busy, setBusy] = React.useState(false);
  const [form] = Form.useForm<TemplateMetadata>();
  const canManage = data?.canManage === true;
  const templates = data?.templates ?? [];
  const metadata = (item: ApiDesignTemplate) =>
    canManage ? (item.draft ?? item.published) : item.published;
  const categories = [
    ...new Set(
      templates.map((item) => metadata(item)?.category).filter(Boolean),
    ),
  ].sort();
  const libraries = [
    ...new Set(templates.flatMap((item) => item.published?.libraries ?? [])),
  ].sort();
  const kindOptions = [
    { value: "page", label: t("Page template") },
    { value: "section", label: t("Section template") },
  ];
  const deviceOptions = [
    { value: "mobile", label: t("Mobile") },
    { value: "desktop", label: t("Desktop") },
    { value: "responsive", label: t("Responsive") },
  ];
  const filtered = templates.filter((item) => {
    const meta = metadata(item);
    return (
      meta &&
      (kind === "all" || meta.kind === kind) &&
      (device === "all" || meta.device === device) &&
      (category === "all" || meta.category === category) &&
      (library === "all" || item.published?.libraries.includes(library)) &&
      `${meta.name} ${meta.description}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    );
  });

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      void message.error(
        err instanceof Error ? err.message : t("Template operation failed"),
      );
    }
    setBusy(false);
  }
  function edit(item: ApiDesignTemplate | "new") {
    form.setFieldsValue(
      item === "new" ? emptyDraft : (item.draft ?? emptyDraft),
    );
    setEditing(item);
  }
  async function save(values: TemplateMetadata) {
    await run(async () => {
      if (editing === "new") {
        const { template } = await appCtx.api.createDesignTemplate(values);
        setEditing(undefined);
        history.push(APP_ROUTES.project.fill({ projectId: template.id }));
      } else if (editing) {
        await appCtx.api.updateDesignTemplate(editing.id, values);
        setEditing(undefined);
        await mutate();
        void message.success(t("Template draft saved"));
      }
    });
  }
  async function openPreview(item: ApiDesignTemplate) {
    await run(async () => {
      // Resolve again at the point of use; do not open a stale/unpublished card.
      const current = await mutate();
      const publication = current?.templates.find(
        (value) => value.id === item.id,
      )?.published;
      if (!publication) {
        throw new Error(t("This template is no longer published"));
      }
      setPreview(publication);
    });
  }

  return (
    <section className={styles.root}>
      {documentTitle(t("Template center"))}
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("Template center")}
        </Typography.Title>
        {canManage && (
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            disabled={busy}
            onClick={() => edit("new")}
          >
            {t("New template")}
          </Button>
        )}
      </Flex>
      <Flex gap={12} wrap>
        <Input.Search
          aria-label={t("Search templates")}
          placeholder={t("Search templates")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          aria-label={t("Template type")}
          value={kind}
          onChange={setKind}
          style={{ minWidth: 140 }}
          options={[{ value: "all", label: t("All types") }, ...kindOptions]}
        />
        <Select
          aria-label={t("Device")}
          value={device}
          onChange={setDevice}
          style={{ minWidth: 140 }}
          options={[
            { value: "all", label: t("All devices") },
            ...deviceOptions,
          ]}
        />
        <Select
          aria-label={t("Category")}
          value={category}
          onChange={setCategory}
          style={{ minWidth: 160 }}
          options={[
            { value: "all", label: t("All categories") },
            ...categories.map((value) => ({ value, label: value })),
          ]}
        />
        <Select
          aria-label={t("Component library")}
          value={library}
          onChange={setLibrary}
          style={{ minWidth: 180 }}
          options={[
            { value: "all", label: t("All component libraries") },
            ...libraries.map((value) => ({ value, label: value })),
          ]}
        />
      </Flex>
      {error ? (
        <Alert
          type="error"
          title={t("Failed to load templates")}
          action={
            <Button
              loading={isValidating}
              onClick={() => void mutate().catch(() => undefined)}
            >
              {t("Retry")}
            </Button>
          }
        />
      ) : !data ? (
        <Skeleton active />
      ) : filtered.length === 0 ? (
        <Empty description={t("No templates found")} />
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const meta = metadata(item);
            if (!meta) {
              return null;
            }
            return (
              <Card
                key={item.id}
                cover={
                  meta.thumbnailUrl ? (
                    <img
                      className={styles.cover}
                      src={meta.thumbnailUrl}
                      alt={meta.name}
                    />
                  ) : (
                    <div className={styles.placeholder}>
                      <LayoutOutlined />
                    </div>
                  )
                }
              >
                <Flex vertical gap={12}>
                  <Typography.Text strong>{meta.name}</Typography.Text>
                  <Flex gap={4} wrap>
                    <Tag>
                      {
                        kindOptions.find((option) => option.value === meta.kind)
                          ?.label
                      }
                    </Tag>
                    <Tag>
                      {
                        deviceOptions.find(
                          (option) => option.value === meta.device,
                        )?.label
                      }
                    </Tag>
                    {meta.category && <Tag>{meta.category}</Tag>}
                    {canManage && (
                      <Tag color={item.published ? "green" : "default"}>
                        {t(item.published ? "Published" : "Draft")}
                      </Tag>
                    )}
                  </Flex>
                  {meta.description && (
                    <Typography.Paragraph
                      ellipsis={{ rows: 3 }}
                      style={{ margin: 0 }}
                    >
                      {meta.description}
                    </Typography.Paragraph>
                  )}
                  {item.published && (
                    <Typography.Text type="secondary">
                      {t("Published version")}: {item.published.version}
                    </Typography.Text>
                  )}
                  <Flex gap={8} wrap>
                    {item.published && (
                      <Button
                        disabled={busy}
                        onClick={() => void openPreview(item)}
                      >
                        {t("View published template")}
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <PublicLink
                          href={APP_ROUTES.project.fill({ projectId: item.id })}
                        >
                          {t("Edit canvas")}
                        </PublicLink>
                        <Button disabled={busy} onClick={() => edit(item)}>
                          {t("Edit details")}
                        </Button>
                        <Button
                          type="primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await appCtx.api.publishDesignTemplate(item.id);
                              await mutate();
                              void message.success(t("Template published"));
                            })
                          }
                        >
                          {t("Publish template")}
                        </Button>
                        {item.published ? (
                          <Popconfirm
                            title={t("Unpublish this template?")}
                            onConfirm={() =>
                              run(async () => {
                                await appCtx.api.unpublishDesignTemplate(
                                  item.id,
                                );
                                await mutate();
                              })
                            }
                          >
                            <Button disabled={busy}>{t("Unpublish")}</Button>
                          </Popconfirm>
                        ) : (
                          <Popconfirm
                            title={t("Delete this template?")}
                            onConfirm={() =>
                              run(async () => {
                                await appCtx.api.deleteDesignTemplate(item.id);
                                await mutate();
                              })
                            }
                          >
                            <Button danger disabled={busy}>
                              {t("Delete")}
                            </Button>
                          </Popconfirm>
                        )}
                      </>
                    )}
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </div>
      )}
      <Modal
        open={!!editing}
        title={t(editing === "new" ? "New template" : "Edit template details")}
        onCancel={() => !busy && setEditing(undefined)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText={t(editing === "new" ? "Create and edit" : "Save draft")}
      >
        <Scrollbar scrollX={false} className={styles.formScroll}>
          <Form
            form={form}
            layout="vertical"
            onFinish={save}
            initialValues={emptyDraft}
          >
            <Form.Item
              name="name"
              label={t("Name")}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="kind" label={t("Template type")}>
              <Select options={kindOptions} />
            </Form.Item>
            <Form.Item name="device" label={t("Device")}>
              <Select options={deviceOptions} />
            </Form.Item>
            <Form.Item name="category" label={t("Category")}>
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item name="description" label={t("Description")}>
              <Input.TextArea autoSize={{ minRows: 2 }} maxLength={4000} />
            </Form.Item>
            <Form.Item
              name="thumbnailUrl"
              label={t("Thumbnail URL")}
              rules={[{ type: "url" }]}
            >
              <Input maxLength={2048} />
            </Form.Item>
          </Form>
        </Scrollbar>
      </Modal>
      <Modal
        open={!!preview}
        title={preview?.name}
        width={1200}
        footer={null}
        onCancel={() => setPreview(undefined)}
        destroyOnHidden
      >
        {preview && (
          <>
            <Typography.Paragraph>{preview.description}</Typography.Paragraph>
            <div className={styles.preview}>
              <iframe
                className={styles.frame}
                title={preview.name}
                src={preview.previewUrl}
                style={{ width: preview.device === "mobile" ? 390 : "100%" }}
              />
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
