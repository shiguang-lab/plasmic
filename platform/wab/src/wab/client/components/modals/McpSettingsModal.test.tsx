import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { McpSettingsModalHost } from "@/wab/client/components/modals/McpSettingsModal";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
  delete window.desktopMcpSettings;
});
function mount() {
  render(
    <AntdConfigProvider>
      <McpSettingsModalHost />
    </AntdConfigProvider>,
  );
}
function open() {
  act(() => {
    window.dispatchEvent(new Event("plasmic:open-mcp-settings"));
  });
}

test("Web opens the Studio Modal and explains how to configure local clients", async () => {
  mount();
  expect(screen.queryByRole("dialog")).toBeNull();
  open();
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(
    screen.getByText(/Open AI → MCP in the Plasmic desktop app/),
  ).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("desktop menu opens the same Modal, updates a client and copies its actual config", async () => {
  let onOpen = () => {};
  const client = {
    id: "codex",
    label: "Codex CLI",
    path: "/fixture/config.toml",
    enabled: false,
    selected: false,
    error: "",
  };
  const set = vi
    .fn()
    .mockResolvedValue({ clients: [{ ...client, enabled: true }] });
  const copy = vi.fn().mockResolvedValue(true);
  const unsubscribe = vi.fn();
  window.desktopMcpSettings = {
    get: vi
      .fn()
      .mockResolvedValue({ clients: [client], config: '{"mcpServers":{}}' }),
    set,
    copy,
    onOpen: (callback) => {
      onOpen = callback;
      return unsubscribe;
    },
  };
  mount();
  act(() => onOpen());
  const toggle = await screen.findByRole("switch", { name: "Codex CLI" });
  fireEvent.click(toggle);
  await screen.findByText("Configured");
  expect(set).toHaveBeenCalledWith("codex", true);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "Copy MCP configuration" }),
  );
  await screen.findByText("MCP configuration copied.");
  expect(copy).toHaveBeenCalledOnce();
  expect(screen.queryByText("Image service")).toBeNull();
  cleanup();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("reports failed client changes and keeps the configuration returned by desktop", async () => {
  const client = {
    id: "codex",
    label: "Codex CLI",
    path: "/fixture",
    enabled: false,
    selected: false,
    error: "",
  };
  window.desktopMcpSettings = {
    get: vi.fn().mockResolvedValue({ clients: [client], config: "fixture" }),
    set: vi
      .fn()
      .mockResolvedValue({
        clients: [client],
        error: "Configuration conflict",
      }),
    copy: vi.fn(),
    onOpen: () => () => {},
  };
  mount();
  open();
  const toggle = await screen.findByRole("switch", { name: "Codex CLI" });
  fireEvent.click(toggle);
  await screen.findByText("Configuration conflict");
  expect(toggle.getAttribute("aria-checked")).toBe("false");
});
