import { AntdConfigProvider } from "@/wab/client/antd-theme";
import WebhooksItem, {
  ToggleWebhook,
} from "@/wab/client/components/webhooks/WebhooksItem";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";

const webhook: ToggleWebhook = {
  id: "webhook-id",
  method: "POST",
  url: "https://example.com/hook",
  headers: [{ key: "Authorization", value: "token" }],
  payload: '{"event":"publish"}',
  includeChangeData: false,
  enable: true,
};

afterEach(cleanup);

it("edits a controlled webhook immutably and preserves the other fields", () => {
  const setWebhook = vi.fn();
  render(
    <AntdConfigProvider>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <WebhooksItem
          webhook={webhook}
          setWebhook={setWebhook}
          enabled={webhook.enable}
          setEnabled={vi.fn()}
          onRemove={vi.fn()}
        />
      </ConfigProvider>
    </AntdConfigProvider>,
  );

  fireEvent.change(screen.getByRole("textbox", { name: "URL" }), {
    target: { value: "https://example.com/updated" },
  });

  expect(setWebhook).toHaveBeenCalledExactlyOnceWith({
    ...webhook,
    url: "https://example.com/updated",
  });
  expect(webhook.url).toBe("https://example.com/hook");
  expect(webhook.headers).toEqual([{ key: "Authorization", value: "token" }]);
});
