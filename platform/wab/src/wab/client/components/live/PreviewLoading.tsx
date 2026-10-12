import { useI18n } from "@/wab/client/i18n";
import * as React from "react";
import "./PreviewLoading.css";

export function PreviewLoading({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="preview-loading">
      {children ?? (
        <div
          role="status"
          aria-label={t("Loading preview…")}
          aria-busy="true"
          className="preview-loading__content"
        >
          {[0, 1, 2].map((page) => (
            <div
              className="preview-loading__page"
              aria-hidden="true"
              key={page}
            >
              <div className="preview-loading__header">
                <span className="preview-loading__placeholder preview-loading__logo" />
                <span className="preview-loading__placeholder preview-loading__action" />
              </div>
              <div className="preview-loading__body">
                <div className="preview-loading__nav">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <span className="preview-loading__placeholder" key={item} />
                  ))}
                </div>
                <div className="preview-loading__main">
                  <span className="preview-loading__placeholder preview-loading__heading" />
                  <span className="preview-loading__placeholder preview-loading__description" />
                  <div className="preview-loading__filters">
                    {[0, 1, 2].map((item) => (
                      <span
                        className="preview-loading__placeholder"
                        key={item}
                      />
                    ))}
                  </div>
                  <div className="preview-loading__table">
                    {[0, 1, 2, 3, 4, 5].map((row) => (
                      <div className="preview-loading__row" key={row}>
                        {[0, 1, 2].map((cell) => (
                          <span
                            className="preview-loading__placeholder"
                            key={cell}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <span className="preview-loading__placeholder preview-loading__pagination" />
                </div>
              </div>
            </div>
          ))}
          <span className="preview-loading__label">
            {t("Loading preview…")}
          </span>
        </div>
      )}
    </div>
  );
}
