import styles from "@/wab/client/components/BrandLink.module.scss";
import { BrandLogo } from "@/wab/client/components/BrandLogo";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { useI18n } from "@/wab/client/i18n";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import { Tooltip, theme as AntdTheme } from "antd";
import * as React from "react";

export function BrandLink({
  brand = {},
  className,
  ...props
}: React.ComponentProps<"a"> & { brand?: UiConfig["brand"] }) {
  const { t } = useI18n();
  const { token } = AntdTheme.useToken();
  const label = brand.logoTooltip ?? t("Back to dashboard");
  return (
    <Tooltip title={label}>
      <PublicLink
        {...props}
        className={`${className ?? ""} ${styles.brandLink}`}
        href={brand.logoHref ?? props.href ?? APP_ROUTES.allProjects.fill({})}
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
              <BrandLogo aria-hidden="true" />
              <span>Plasmic</span>
            </>
          )}
        </span>
      </PublicLink>
    </Tooltip>
  );
}
