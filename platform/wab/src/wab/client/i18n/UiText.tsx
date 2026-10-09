import { useI18n } from "@/wab/client/i18n";
import { MessageKey } from "@/wab/client/i18n/locales";
import * as React from "react";

/** A subscribed message for static JSX, including generated presentation views. */
export function UiText(props: {
  message: MessageKey;
  values?: Record<string, React.ReactNode>;
}) {
  const { t } = useI18n();
  const message = t(props.message);
  if (!props.values) {
    return <>{message}</>;
  }
  return (
    <>
      {message.split(/(\{\w+\})/g).map((part, index) => {
        const value = /^\{\w+\}$/.test(part)
          ? props.values?.[part.slice(1, -1)]
          : undefined;
        return (
          <React.Fragment key={index}>
            {value === undefined ? part : value}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** Localize a display label while preserving its underlying metadata. */
export function UiLabel(props: { text: string }) {
  const { label } = useI18n();
  return <>{label(props.text)}</>;
}
