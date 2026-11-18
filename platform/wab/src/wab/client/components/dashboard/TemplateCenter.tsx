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
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  EllipsisOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Button,
  Dropdown,
  Flex,
  Form,
  Input,
  Select,
  Skeleton,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import useSWR from "swr";

const useStyles = createStyles(({ token }) => ({
  root: {
    width: "100%",
    maxWidth: 1440,
    margin: "0 auto",
    padding: "48px 48px 64px",
    display: "flex",
    flexDirection: "column",
    gap: 32,
    "@media (max-width: 760px)": { padding: "28px 20px 40px", gap: 24 },
  },
  heading: {
    margin: "0 !important",
    fontSize: "32px !important",
    fontWeight: "600 !important",
    letterSpacing: "-0.8px",
  },
  subtitle: {
    color: token.colorTextSecondary,
    fontSize: 14,
    margin: "10px 0 0",
  },
  toolbar: { display: "flex", flexDirection: "column", gap: 16 },
  tabs: {
    minWidth: 250,
    "& .ant-tabs-nav": { margin: 0 },
    "& .ant-tabs-nav::before": { border: 0 },
  },
  search: {
    width: 280,
    borderRadius: 10,
    "@media (max-width: 600px)": { width: "100%" },
  },
  filters: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  categories: { display: "flex", gap: 8, flexWrap: "wrap" },
  category: { borderRadius: 20, color: token.colorTextSecondary },
  activeCategory: {
    borderRadius: 20,
    background: token.colorText,
    color: token.colorBgContainer,
    "&:hover": {
      background: `${token.colorText} !important`,
      color: `${token.colorBgContainer} !important`,
    },
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
    gap: "32px 24px",
  },
  card: { minWidth: 0 },
  coverButton: {
    display: "block",
    position: "relative",
    width: "100%",
    aspectRatio: "4 / 3",
    padding: 0,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 16,
    overflow: "hidden",
    background: token.colorFillAlter,
    cursor: "pointer",
    color: token.colorText,
    transition: "box-shadow 180ms ease, transform 180ms ease",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: token.boxShadowSecondary,
    },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 4,
    },
    "&:hover .template-cover-action, &:focus-visible .template-cover-action": {
      opacity: 1,
      transform: "translateY(0)",
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
  cover: {
    display: "block",
    height: "100%",
    width: "100%",
    objectFit: "cover",
  },
  placeholder: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: token.colorTextQuaternary,
    fontSize: 13,
    "& .anticon": { fontSize: 30 },
  },
  coverAction: {
    position: "absolute",
    bottom: 16,
    right: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 20,
    background: token.colorBgElevated,
    color: token.colorText,
    boxShadow: token.boxShadowSecondary,
    fontSize: 12,
    opacity: 0,
    transform: "translateY(4px)",
    transition: "opacity 180ms ease, transform 180ms ease",
    "@media (hover: none)": { opacity: 1, transform: "none" },
  },
  status: {
    position: "absolute",
    left: 14,
    top: 14,
    padding: "4px 9px",
    borderRadius: 6,
    background: token.colorBgElevated,
    color: token.colorTextSecondary,
    fontSize: 11,
  },
  cardBody: { padding: "14px 2px 0" },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    margin: 0,
  },
  cardMeta: {
    marginTop: 5,
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: token.colorTextSecondary,
    fontSize: 12,
  },
  description: {
    margin: "8px 0 0",
    color: token.colorTextTertiary,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    minHeight: 360,
    padding: "48px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorFillAlter,
    display: "grid",
    placeItems: "center",
    color: token.colorTextTertiary,
    fontSize: 28,
    marginBottom: 24,
  },
  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-0.4px",
  },
  emptyDescription: {
    maxWidth: 360,
    margin: "0 0 24px",
    color: token.colorTextSecondary,
    fontSize: 14,
    lineHeight: 1.7,
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

  return (
    <section className={styles.root}>
      {documentTitle(t("Template center"))}
      <Flex justify="space-between" align="center" wrap gap={20}>
        <div>
          <Typography.Title level={1} className={styles.heading}>
            {t("Template center")}
          </Typography.Title>
          <p className={styles.subtitle}>
            {t("Explore ideas for your next design.")}
          </p>
        </div>
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
      <div className={styles.toolbar}>
        <Flex justify="space-between" align="center" wrap gap={16}>
          <Tabs
            className={styles.tabs}
            activeKey={kind}
            onChange={setKind}
            items={[
              { key: "all", label: t("All templates") },
              ...kindOptions.map((option) => ({
                key: option.value,
                label: option.label,
              })),
            ]}
          />
          <Input
            type="search"
            className={styles.search}
            size="large"
            prefix={<SearchOutlined aria-hidden />}
            aria-label={t("Search templates")}
            placeholder={t("Search templates")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
          />
        </Flex>
        <div className={styles.filters}>
          <div
            className={styles.categories}
            role="group"
            aria-label={t("Category")}
          >
            {[
              { value: "all", label: t("All categories") },
              ...categories.map((value) => ({ value, label: value })),
            ].map((option) => (
              <Button
                key={option.value}
                type="text"
                className={
                  category === option.value
                    ? styles.activeCategory
                    : styles.category
                }
                aria-pressed={category === option.value}
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Flex gap={8} wrap align="center">
            <Select
              aria-label={t("Device")}
              value={device}
              onChange={setDevice}
              variant="borderless"
              style={{ minWidth: 120 }}
              options={[
                { value: "all", label: t("All devices") },
                ...deviceOptions,
              ]}
            />
            <Select
              aria-label={t("Component library")}
              value={library}
              onChange={setLibrary}
              variant="borderless"
              style={{ minWidth: 175 }}
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
          </Flex>
        </div>
      </div>
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
        <div className={styles.grid} aria-label={t("Loading templates")}>
          {[0, 1, 2, 3].map((key) => (
            <div key={key}>
              <Skeleton.Node
                active
                style={{
                  width: "100%",
                  height: "auto",
                  aspectRatio: "4 / 3",
                  borderRadius: 16,
                }}
              />
              <Skeleton active title paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden>
            {hasFilters ? <SearchOutlined /> : <AppstoreOutlined />}
          </div>
          <h2 className={styles.emptyTitle}>
            {t(
              hasFilters ? "No templates found" : "A place for your next idea",
            )}
          </h2>
          <p className={styles.emptyDescription}>
            {t(
              hasFilters
                ? "Try another keyword or clear your filters."
                : canManage
                  ? "Share your first template and give great ideas a place to start."
                  : "New templates will appear here. Come back for a little inspiration.",
            )}
          </p>
          {hasFilters ? (
            <Button onClick={clearFilters}>{t("Show all templates")}</Button>
          ) : (
            canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined aria-hidden />}
                onClick={() => edit("new")}
              >
                {t("Create your first template")}
              </Button>
            )
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const meta = metadata(item);
            if (!meta) {
              return null;
            }
            return (
              <article key={item.id} className={styles.card}>
                <button
                  className={styles.coverButton}
                  disabled={busy}
                  aria-label={t(
                    item.published ? "View published template" : "Edit canvas",
                  )}
                  onClick={() =>
                    item.published
                      ? void openPreview(item)
                      : history.push(
                          APP_ROUTES.project.fill({ projectId: item.id }),
                        )
                  }
                >
                  <TemplateCover url={meta.thumbnailUrl} name={meta.name} />
                  {canManage && (
                    <span className={styles.status}>
                      {t(item.published ? "Published" : "Draft")}
                    </span>
                  )}
                  <span
                    className={`template-cover-action ${styles.coverAction}`}
                  >
                    {t(item.published ? "Preview" : "Edit canvas")}
                    <ArrowRightOutlined aria-hidden />
                  </span>
                </button>
                <div className={styles.cardBody}>
                  <Flex justify="space-between" align="center" gap={12}>
                    <h2 className={styles.cardTitle} title={meta.name}>
                      {meta.name}
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
                          type="text"
                          size="small"
                          disabled={busy}
                          aria-label={t("More actions")}
                          icon={<EllipsisOutlined />}
                        />
                      </Dropdown>
                    )}
                  </Flex>
                  <div className={styles.cardMeta}>
                    <span>
                      {
                        deviceOptions.find(
                          (option) => option.value === meta.device,
                        )?.label
                      }
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {meta.category ||
                        kindOptions.find((option) => option.value === meta.kind)
                          ?.label}
                    </span>
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

function TemplateCover({ url, name }: { url: string; name: string }) {
  const { styles } = useStyles();
  const { t } = useI18n();
  const [failedUrl, setFailedUrl] = React.useState<string>();
  return url && failedUrl !== url ? (
    <img
      className={styles.cover}
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  ) : (
    <div className={styles.placeholder}>
      <PictureOutlined aria-hidden />
      <span>{t("No cover yet")}</span>
    </div>
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
