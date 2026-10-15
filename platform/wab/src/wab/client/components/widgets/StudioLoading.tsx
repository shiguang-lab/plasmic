import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { Skeleton } from "antd";
import * as React from "react";

export function StudioLoading() {
  const { t } = useI18n();
  return (
    <div
      className="studio-loading visible"
      role="status"
      aria-label={t("Loading project…")}
      aria-busy="true"
    >
      <div className="studio-loading__pages" aria-hidden="true">
        {[0, 1, 2].map((page) => (
          <div className="studio-loading__page" key={page}>
            <Skeleton.Input
              active
              block
              className="studio-loading__page-label"
            />
            <div className="studio-loading__artboard">
              <div className="studio-loading__page-header">
                <Skeleton.Input active block className="studio-loading__logo" />
                <Skeleton.Input
                  active
                  block
                  className="studio-loading__action"
                />
              </div>
              <div className="studio-loading__page-body">
                <div className="studio-loading__sidebar">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <Skeleton.Input active block key={item} />
                  ))}
                </div>
                <div className="studio-loading__main">
                  <Skeleton.Input
                    active
                    block
                    className="studio-loading__heading"
                  />
                  <div className="studio-loading__filters">
                    {[0, 1, 2].map((filter) => (
                      <Skeleton.Input active block key={filter} />
                    ))}
                  </div>
                  <div className="studio-loading__table">
                    {[0, 1, 2, 3, 4].map((row) => (
                      <div className="studio-loading__row" key={row}>
                        {[0, 1, 2].map((cell) => (
                          <Skeleton.Input active block key={cell} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <Skeleton.Input
                    active
                    block
                    className="studio-loading__pagination"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <span className="studio-loading__label">
        <UiText message={"Loading project…"} />
      </span>
    </div>
  );
}
