import styles from "@/wab/client/components/BrandLink.module.scss";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { useI18n } from "@/wab/client/i18n";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import { Tooltip, theme } from "antd";
import * as React from "react";

export function BrandLink({
  brand = {},
  className,
  ...props
}: React.ComponentProps<"a"> & { brand?: UiConfig["brand"] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const label = brand.logoTooltip ?? t("Back to dashboard");
  return (
    <Tooltip title={label}>
      <PublicLink
        {...props}
        className={`${className ?? ""} ${styles.brandLink}`}
        href={brand.logoHref ?? props.href ?? APP_ROUTES.dashboard.fill({})}
        aria-label={label}
      >
        <span
          className={styles.identity}
          style={{ color: token.colorText, fontFamily: token.fontFamily }}
        >
          {brand.logoImgSrc ? (
            <img src={brand.logoImgSrc} alt={brand.logoAlt ?? label} />
          ) : (
            <>
              <svg
                viewBox="0 0 32 32"
                aria-hidden="true"
                style={{ fill: token.colorPrimary }}
              >
                <path d="M7 3h14a8 8 0 0 1 0 16h-7l4-5h3a3 3 0 0 0 0-6H11z M11 13h7l-4 5h-3a3 3 0 0 0 0 6h10l-4 5h-6a8 8 0 0 1 0-16z" />
              </svg>
              <span>Plasmic</span>
            </>
          )}
        </span>
      </PublicLink>
    </Tooltip>
  );
}
