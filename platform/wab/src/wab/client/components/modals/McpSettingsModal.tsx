import { Modal } from "@/wab/client/components/widgets/Modal";
import { formatErrorMessage } from "@/wab/shared/error-handling";
import { Alert, Button, Divider, Spin, Switch } from "antd";
import React from "react";

interface McpClient {
  id: string;
  label: string;
  path: string;
  enabled: boolean;
  selected: boolean;
  error: string;
}
interface McpSettings {
  clients: McpClient[];
  config: string;
}
export interface DesktopMcpSettings {
  get: () => Promise<McpSettings>;
  set: (
    id: string,
    enabled: boolean,
  ) => Promise<{ clients: McpClient[]; error?: string }>;
  copy: () => Promise<boolean>;
  onOpen: (callback: () => void) => () => void;
}
declare global {
  interface Window {
    desktopMcpSettings?: DesktopMcpSettings;
  }
}

export function McpSettingsModal({ onClose }: { onClose: () => void }) {
  const bridge = window.desktopMcpSettings;
  const [settings, setSettings] = React.useState<McpSettings>();
  const [pending, setPending] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  React.useEffect(() => {
    if (!bridge) {
      return;
    }
    let active = true;
    bridge.get().then(
      (value) => {
        if (active) {
          setSettings(value);
        }
      },
      (err) => {
        if (active) {
          setError(formatErrorMessage(err));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [bridge]);

  async function toggle(id: string, enabled: boolean) {
    setPending(id);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await bridge?.set(id, enabled);
      if (result) {
        setSettings((value) => value && { ...value, clients: result.clients });
        setError(result.error);
        if (!result.error) {
          setNotice(
            "Configuration updated. Restart the client or refresh its MCP configuration.",
          );
        }
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setPending(undefined);
    }
  }
  async function copy() {
    setError(undefined);
    try {
      await bridge?.copy();
      setNotice("MCP configuration copied.");
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }
  return (
    <Modal
      title="MCP connections"
      open
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0 }}>
          Connect AI clients to read and edit your Plasmic projects. Keep
          Plasmic running and open the project you want to edit while signed in.
        </p>
        {!bridge && (
          <Alert
            type="info"
            showIcon
            message="Open AI → MCP in the Plasmic desktop app to configure local AI clients. Browser apps cannot update configuration files on your computer."
          />
        )}
        {error && <Alert type="error" showIcon message={error} />}
        {bridge && !settings && !error && (
          <Spin aria-label="Loading MCP configuration" />
        )}
        {settings && (
          <>
            <div>
              {settings.clients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "8px 0",
                    borderBottom: "1px solid #efefed",
                  }}
                >
                  <div title={client.path}>
                    <div>{client.label}</div>
                    <div
                      style={{ color: client.error ? "#d32f2f" : "#706f6c" }}
                    >
                      {client.error ||
                        (client.enabled
                          ? "Configured"
                          : client.selected
                            ? "Configuration missing. Enable again to restore it."
                            : "Disabled")}
                    </div>
                  </div>
                  <Switch
                    size="small"
                    aria-label={client.label}
                    checked={client.enabled}
                    loading={pending === client.id}
                    disabled={pending !== undefined}
                    onChange={(enabled) => void toggle(client.id, enabled)}
                  />
                </div>
              ))}
            </div>
            <p style={{ margin: 0 }}>
              Enabled clients are configured at startup.
            </p>
            <Divider style={{ margin: 0 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <strong>Custom MCP configuration</strong>
              <Button size="small" onClick={() => void copy()}>
                Copy MCP configuration
              </Button>
            </div>
            <p style={{ margin: 0 }}>
              For other MCP tools, add this configuration to their MCP server
              settings.
            </p>
            <pre
              style={{
                maxHeight: 140,
                margin: 0,
                padding: 12,
                background: "#f7f7f5",
                borderRadius: 4,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 11,
              }}
            >
              {settings.config}
            </pre>
          </>
        )}
        {notice && <div role="status">{notice}</div>}
      </div>
    </Modal>
  );
}

export function McpSettingsModalHost() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("plasmic:open-mcp-settings", show);
    const unsubscribe = window.desktopMcpSettings?.onOpen(show);
    return () => {
      window.removeEventListener("plasmic:open-mcp-settings", show);
      unsubscribe?.();
    };
  }, []);
  return open ? <McpSettingsModal onClose={() => setOpen(false)} /> : null;
}
