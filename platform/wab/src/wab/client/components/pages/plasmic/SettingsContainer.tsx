import styles from "@/wab/client/components/pages/plasmic/SettingsContainer.module.scss";
import { AsyncState } from "@/wab/client/hooks/useAsyncStrict";
import { languageOptions, useI18n } from "@/wab/client/i18n";
import { ApiTrustedHost, PersonalApiToken } from "@/wab/shared/ApiSchema";
import { Button, Select } from "antd";
import * as React from "react";

interface SettingsContainerProps {
  avatarImgUrl?: string;
  name: string;
  email: string;
  tokensState: AsyncState<PersonalApiToken[]>;
  onNewToken: () => void;
  onDeleteToken: (val: string) => void;
  copiedToken: string;
  onCopyToken: (e: React.MouseEvent, val: string) => void;
  hostsState: "loading" | "error" | ApiTrustedHost[] | undefined;
  onDeleteTrustedHost: (host: ApiTrustedHost) => void;
  onNewTrustedHost: () => void;
}

export default function SettingsContainer(props: SettingsContainerProps) {
  const { t, preference, setLanguagePreference } = useI18n();
  const [languageError, setLanguageError] = React.useState(false);
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1>{t("Settings")}</h1>
        <p>{t("Manage your account and application preferences.")}</p>
      </header>
      <section className={styles.card} aria-labelledby="account-heading">
        <h2 id="account-heading">{t("Account")}</h2>
        <p>{t("Your profile is managed through your Shiguang account.")}</p>
        <div className={styles.account}>
          <div className={styles.profile}>
            <div className={styles.avatar} aria-hidden="true">
              {props.avatarImgUrl ? <img src={props.avatarImgUrl} alt="" /> : props.name.slice(0, 2).toUpperCase()}
            </div>
            <div><strong>{props.name}</strong><div className={styles.email}>{props.email}</div></div>
          </div>
          <Button href="https://shiguanglab.com/account" target="_blank" rel="noreferrer">{t("Manage Shiguang account")}</Button>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="preferences-heading">
        <h2 id="preferences-heading">{t("Preferences")}</h2>
        <div className={styles.preference}>
          <div>
            <label htmlFor="ui-language">{t("Language")}</label>
            <p>{t("Choose the language used throughout the application.")}</p>
          </div>
          <Select
            id="ui-language"
            className={styles.languageSelect}
            value={preference}
            options={[{ value: "system", label: t("Follow system") }, ...languageOptions]}
            onChange={(value) => {
              try {
                setLanguagePreference(value);
                setLanguageError(false);
              } catch {
                setLanguageError(true);
              }
            }}
          />
        </div>
        {languageError ? <p role="alert" className={styles.error}>{t("Unable to save language preference on this device.")}</p> : <p className={styles.hint}>{t("Changes apply immediately and are saved on this device.")}</p>}
      </section>
      <section className={styles.card} aria-labelledby="tokens-heading">
        <div className={styles.sectionHeader}>
          <div><h2 id="tokens-heading">{t("Personal access tokens")}</h2><p>{t("Use tokens to connect tools and integrations to your account.")}</p></div>
          <Button onClick={props.onNewToken}>{t("New token")}</Button>
        </div>
        {props.tokensState.loading ? <p role="status">{t("Loading…")}</p> : props.tokensState.error ? <p role="alert" className={styles.error}>{t("Unable to load access tokens.")}</p> : !props.tokensState.value?.length ? <div className={styles.empty}>{t("No access tokens yet.")}</div> : (
          <ul className={styles.list}>
            {props.tokensState.value.map((token) => (
              <li key={token.token}>
                <code className={styles.token}>{token.token}</code>
                <div className={styles.actions}>
                  <Button onClick={(e) => props.onCopyToken(e, token.token)}>{t(props.copiedToken === token.token ? "Copied" : "Copy")}</Button>
                  <Button danger onClick={() => props.onDeleteToken(token.token)}>{t("Revoke")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>{t("Keep your tokens private. They provide access to your account.")}</p>
      </section>
      <section className={styles.card} aria-labelledby="hosts-heading">
        <div className={styles.sectionHeader}>
          <div><h2 id="hosts-heading">{t("Trusted host apps")}</h2><p>{t("Allow custom app hosts from domains you trust.")}</p></div>
          <Button onClick={props.onNewTrustedHost}>{t("Add URL")}</Button>
        </div>
        {!props.hostsState || props.hostsState === "loading" ? <p role="status">{t("Loading…")}</p> : props.hostsState === "error" ? <p role="alert" className={styles.error}>{t("Unable to load trusted hosts.")}</p> : !props.hostsState.length ? <div className={styles.empty}>{t("No trusted hosts yet.")}</div> : (
          <ul className={styles.list}>
            {props.hostsState.map((host) => (
              <li key={host.id}>
                <span className={styles.host}>{host.hostUrl}</span>
                <Button danger onClick={() => props.onDeleteTrustedHost(host)}>{t("Delete")}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
