import * as React from "react";
import { Helmet } from "react-helmet-async";

export function documentTitle(title: string) {
  return (
    <Helmet>
      <title>{title ? `${title} - Plasmic` : `Plasmic`}</title>
    </Helmet>
  );
}
