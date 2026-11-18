import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { ProjectCardsSkeleton } from "@/wab/client/components/widgets/ContentSkeletons";
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
import {
  EllipsisOutlined,
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  Select,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import useSWR from "swr";

const useStyles = createStyles(({ token }) => ({
  navigation: {
    "@container workspace-tabs (width > 1240px)": {
      "&& > .ant-tabs-nav": { minWidth: "max-content" },
    },
    "@container workspace-tabs (max-width: 1240px)": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: 8,
      paddingBottom: 12,
      "& > div:last-child": { paddingBlock: 0 },
    },
  },
  search: {
    width: 240,
    maxWidth: "100%",
    "@container workspace-tabs (max-width: 480px)": { width: "100%" },
  },
  filter: {
    width: 144,
    "@container workspace-tabs (max-width: 480px)": {
      maxWidth: "calc((100% - 8px) / 2)",
    },
  },
  libraryFilter: { maxWidth: "100%", width: 184 },
  catalog: {
    [`&& .${dashboard.thumbnail}`]: {
      height: "auto",
      padding: 0,
      aspectRatio: "4 / 3",
      overflow: "hidden",
      borderBottom: 0,
    },
    [`& .${dashboard.content}`]: { borderTop: "1px solid var(--ui-border)" },
  },
  card: { position: "relative" },
  cover: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  coverBackdrop: {
    "&&": { objectFit: "cover" },
    filter: "blur(20px)",
    transform: "scale(1.16)",
  },
  placeholder: {
    margin: "auto",
    color: token.colorTextTertiary,
    fontSize: 24,
  },
  cardOpen: {
    display: "block",
    width: "100%",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:enabled::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      borderRadius: token.borderRadiusLG,
    },
    "&:enabled": { cursor: "pointer" },
    "&:focus-visible": { outline: "none" },
    "&:focus-visible::after": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: -2,
    },
  },
  cardMenu: { position: "relative", zIndex: 1, flexShrink: 0 },
  description: {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    margin: 0,
    color: token.colorTextSecondary,
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  upload: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: 20,
    borderRadius: 12,
    border: `1px dashed ${token.colorBorder}`,
    background: token.colorFillAlter,
  },
  uploadPreview: {
    width: "100%",
    maxHeight: 180,
    objectFit: "contain",
    borderRadius: 8,
  },
  uploadHint: {
    margin: 0,
    fontSize: 12,
    color: token.colorTextSecondary,
    textAlign: "center",
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
  const { styles, cx } = useStyles();
  const { styles: layout } = useProjectBrowserStyles();
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
  const [confirming, setConfirming] = React.useState<ApiDesignTemplate>();
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form] = Form.useForm<TemplateMetadata>();
  const canManage = data?.canManage === true;
  const templates = data?.templates ?? [];
  const metadata = (item: ApiDesignTemplate) =>
    canManage ? (item.draft ?? item.published) : item.published;
  const categories = [
    ...new Set(
      templates
        .map((item) => metadata(item)?.category)
        .filter((value): value is string => !!value),
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

  const hasFilters =
    !!search.trim() ||
    [kind, device, category, library].some((value) => value !== "all");
  function clearFilters() {
    setSearch("");
    setKind("all");
    setDevice("all");
    setCategory("all");
    setLibrary("all");
  }

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
    if (busy || uploading) {
      return;
    }
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

  const catalog = (
    <div className={cx(layout.workspaceContent, styles.catalog)}>
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
        <ProjectCardsSkeleton label={t("Loading templates")} />
      ) : filtered.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t(
            hasFilters ? "No templates found" : "No templates yet",
          )}
        >
          {hasFilters ? (
            <Button onClick={clearFilters}>{t("Show all templates")}</Button>
          ) : canManage ? (
            <Button
              color="primary"
              variant="text"
              icon={<PlusOutlined aria-hidden />}
              onClick={() => edit("new")}
            >
              {t("Create your first template")}
            </Button>
          ) : null}
        </Empty>
      ) : (
        <div className={layout.grid}>
          {filtered.map((item) => {
            const meta = metadata(item);
            if (!meta) {
              return null;
            }
            const details = [
              kindOptions.find((option) => option.value === meta.kind)?.label,
              deviceOptions.find((option) => option.value === meta.device)
                ?.label,
              meta.category,
            ]
              .filter(Boolean)
              .join(" · ");
            const openLabel = t(
              item.published ? "View published template" : "Edit canvas",
            );
            return (
              <article
                key={item.id}
                className={cx(dashboard.projectCard, styles.card)}
              >
                <div className={dashboard.thumbnail} aria-hidden>
                  <TemplateCover url={meta.thumbnailUrl} />
                </div>
                <div className={dashboard.content}>
                  <div className={dashboard.header}>
                    <h2 className={dashboard.title}>
                      <button
                        type="button"
                        className={styles.cardOpen}
                        disabled={busy}
                        aria-label={`${openLabel}: ${meta.name}`}
                        title={`${openLabel}: ${meta.name}`}
                        onClick={() =>
                          item.published
                            ? void openPreview(item)
                            : history.push(
                                APP_ROUTES.project.fill({ projectId: item.id }),
                              )
                        }
                      >
                        {meta.name}
                      </button>
                    </h2>
                    {canManage && (
                      <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                          items: [
                            {
                              key: "canvas",
                              label: t("Edit canvas"),
                              onClick: () =>
                                history.push(
                                  APP_ROUTES.project.fill({
                                    projectId: item.id,
                                  }),
                                ),
                            },
                            {
                              key: "details",
                              label: t("Edit details"),
                              onClick: () => edit(item),
                            },
                            {
                              key: "publish",
                              label: t("Publish template"),
                              onClick: () =>
                                void run(async () => {
                                  await appCtx.api.publishDesignTemplate(
                                    item.id,
                                  );
                                  await mutate();
                                  void message.success(t("Template published"));
                                }),
                            },
                            { type: "divider" },
                            {
                              key: "remove",
                              label: t(item.published ? "Unpublish" : "Delete"),
                              danger: true,
                              onClick: () => setConfirming(item),
                            },
                          ],
                        }}
                      >
                        <Button
                          className={styles.cardMenu}
                          type="text"
                          size="small"
                          disabled={busy}
                          aria-label={t("More actions")}
                          icon={<EllipsisOutlined />}
                        />
                      </Dropdown>
                    )}
                  </div>
                  <div className={dashboard.meta}>
                    <span title={details}>{details}</span>
                    {canManage && (
                      <span className={dashboard.workspace}>
                        {t(item.published ? "Published" : "Draft")}
                      </span>
                    )}
                  </div>
                  {meta.description && (
                    <p className={styles.description} title={meta.description}>
                      {meta.description}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <section className={layout.root} aria-label={t("Template center")}>
      {documentTitle(t("Template center"))}
      <Tabs
        className={layout.workspaceTabs}
        activeKey={kind}
        onChange={setKind}
        renderTabBar={(props, DefaultTabBar) => (
          <div className={cx(layout.workspaceNavigation, styles.navigation)}>
            <DefaultTabBar {...props} />
            <Flex
              className={layout.workspaceToolbar}
              align="center"
              wrap
              gap={8}
            >
              <Input.Search
                type="search"
                className={styles.search}
                aria-label={t("Search templates")}
                placeholder={t("Search templates")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                allowClear
              />
              <Select
                className={styles.filter}
                aria-label={t("Category")}
                value={category}
                onChange={setCategory}
                options={[
                  { value: "all", label: t("All categories") },
                  ...categories.map((value) => ({ value, label: value })),
                ]}
              />
              <Select
                className={styles.filter}
                aria-label={t("Device")}
                value={device}
                onChange={setDevice}
                options={[
                  { value: "all", label: t("All devices") },
                  ...deviceOptions,
                ]}
              />
              <Select
                className={styles.libraryFilter}
                aria-label={t("Component library")}
                value={library}
                onChange={setLibrary}
                options={[
                  { value: "all", label: t("All component libraries") },
                  ...libraries.map((value) => ({ value, label: value })),
                ]}
              />
              {hasFilters && (
                <Button type="text" onClick={clearFilters}>
                  {t("Clear filters")}
                </Button>
              )}
              {canManage && (
                <Button
                  color="primary"
                  variant="text"
                  icon={<PlusOutlined aria-hidden />}
                  disabled={busy}
                  onClick={() => edit("new")}
                >
                  {t("New template")}
                </Button>
              )}
            </Flex>
          </div>
        )}
        items={[
          { value: "all", label: t("All templates") },
          ...kindOptions,
        ].map(({ value, label }) => ({
          key: value,
          label,
          children: kind === value ? catalog : undefined,
        }))}
      />
      <Modal
        open={!!confirming}
        title={t(
          confirming?.published
            ? "Unpublish this template?"
            : "Delete this template?",
        )}
        onCancel={() => !busy && setConfirming(undefined)}
        confirmLoading={busy}
        okButtonProps={{ danger: true }}
        okText={t(confirming?.published ? "Unpublish" : "Delete")}
        onOk={() =>
          confirming &&
          void run(async () => {
            if (confirming.published) {
              await appCtx.api.unpublishDesignTemplate(confirming.id);
            } else {
              await appCtx.api.deleteDesignTemplate(confirming.id);
            }
            setConfirming(undefined);
            await mutate();
          })
        }
      />
      <Modal
        open={!!editing}
        title={t(editing === "new" ? "New template" : "Edit template details")}
        onCancel={() => !busy && !uploading && setEditing(undefined)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okButtonProps={{ disabled: uploading }}
        cancelButtonProps={{ disabled: busy || uploading }}
        okText={t(editing === "new" ? "Create and edit" : "Save draft")}
      >
        <Scrollbar scrollX={false} className={styles.formScroll}>
          <Form
            form={form}
            layout="vertical"
            onSubmitCapture={(event) => {
              if (busy || uploading) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onFinish={save}
            initialValues={emptyDraft}
          >
            <Form.Item name="thumbnailUrl" label={t("Template cover")}>
              <TemplateCoverUpload
                uploading={uploading}
                setUploading={setUploading}
                disabled={busy}
              />
            </Form.Item>
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

function TemplateCover({ url }: { url: string }) {
  const { styles, cx } = useStyles();
  const [failedUrl, setFailedUrl] = React.useState<string>();
  const [backdropUrl, setBackdropUrl] = React.useState<string>();
  return url && failedUrl !== url ? (
    <>
      {backdropUrl === url && (
        <img
          className={cx(styles.cover, styles.coverBackdrop)}
          src={url}
          alt=""
        />
      )}
      <img
        className={styles.cover}
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailedUrl(url)}
        onLoad={({ currentTarget: { naturalWidth, naturalHeight } }) =>
          setBackdropUrl(
            naturalWidth * 3 === naturalHeight * 4 ? undefined : url,
          )
        }
      />
    </>
  ) : (
    <PictureOutlined className={styles.placeholder} />
  );
}

function TemplateCoverUpload({
  value,
  onChange,
  uploading,
  setUploading,
  disabled,
}: {
  value?: string;
  onChange?: (value: string) => void;
  uploading: boolean;
  setUploading: (value: boolean) => void;
  disabled: boolean;
}) {
  const appCtx = useAppCtx();
  const { t } = useI18n();
  const { styles } = useStyles();
  const [uploadMessage, contextHolder] = message.useMessage();
  return (
    <div className={styles.upload}>
      {contextHolder}
      {value ? (
        <img
          src={value}
          className={styles.uploadPreview}
          alt={t("Template cover")}
        />
      ) : (
        <PictureOutlined style={{ fontSize: 28 }} aria-hidden />
      )}
      <Flex gap={8}>
        <Upload
          accept="image/png,image/jpeg,image/webp"
          showUploadList={false}
          disabled={disabled || uploading}
          beforeUpload={async (file) => {
            if (
              !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
              file.size > 5 * 1024 * 1024
            ) {
              void uploadMessage.error(
                t("Choose a PNG, JPG or WebP image under 5 MB."),
              );
              return false;
            }
            setUploading(true);
            let uploadedUrl: string | undefined;
            try {
              const result = await appCtx.api.uploadImageFile({
                imageFile: file,
              });
              uploadedUrl = result.dataUri;
            } catch {
              void uploadMessage.error(
                t("Cover upload failed. Please try again."),
              );
            }
            setUploading(false);
            if (uploadedUrl) {
              onChange?.(uploadedUrl);
            }
            return false;
          }}
        >
          <Button
            icon={<UploadOutlined aria-hidden />}
            loading={uploading}
            disabled={disabled || uploading}
          >
            {t(value ? "Replace cover" : "Upload cover")}
          </Button>
        </Upload>
        {value && (
          <Button
            type="text"
            disabled={disabled || uploading}
            onClick={() => onChange?.("")}
          >
            {t("Remove image")}
          </Button>
        )}
      </Flex>
      <p className={styles.uploadHint}>
        {t("PNG, JPG or WebP · Up to 5 MB · Recommended 4:3")}
      </p>
    </div>
  );
}
