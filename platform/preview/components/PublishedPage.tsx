import { publicationHref } from "@plasmic-shared/preview";
import type { ComponentRenderData } from "@plasmicapp/loader-nextjs";
import {
  initPlasmicLoader,
  PlasmicComponent,
  PlasmicRootProvider,
} from "@plasmicapp/loader-nextjs";
import NextLink from "next/link";
import * as NextRouter from "next/router";
import React, { useMemo } from "react";
import * as ReactDOMClient from "react-dom/client";

export interface PublishedPageProps {
  code: string;
  projectId: string;
  version: string;
  path: string;
  route: string;
  pageParams: Record<string, string | string[]>;
  pageQuery: Record<string, string | string[] | undefined>;
  data: ComponentRenderData;
}

export default function PublishedPage(props: PublishedPageProps) {
  const { code, projectId, version, data, path, route, pageParams, pageQuery } =
    props;
  const runtime = useMemo(() => {
    const loader = initPlasmicLoader({
      projects: [{ id: projectId, version, token: "" }],
      preview: false,
    });
    const href = (value: string) =>
      publicationHref(code, value, window.location.href);
    function usePublishedRouter() {
      const router = NextRouter.useRouter();
      return {
        ...router,
        pathname: route,
        route,
        asPath: path + window.location.search,
        query: { ...pageParams, ...pageQuery },
        push: (url: string) => router.push(href(url)),
        replace: (url: string) => router.replace(href(url)),
      };
    }
    const PublishedLink = React.forwardRef<
      HTMLAnchorElement,
      React.ComponentProps<typeof NextLink>
    >(function PublishedLink({ href: destination, ...rest }, ref) {
      return (
        <NextLink
          {...rest}
          ref={ref}
          href={
            typeof destination === "string" ? href(destination) : destination
          }
        />
      );
    });
    loader.registerModules({
      "react-dom/client": ReactDOMClient,
      "next/router": { ...NextRouter, useRouter: usePublishedRouter },
      "next/link": PublishedLink,
    });
    return { loader, PublishedLink };
  }, [code, projectId, version, path, route, pageParams, pageQuery]);
  return (
    <PlasmicRootProvider
      loader={runtime.loader}
      prefetchedData={data}
      Link={runtime.PublishedLink}
      pageRoute={route}
      pageParams={pageParams}
      pageQuery={pageQuery}
    >
      <PlasmicComponent
        component={data.entryCompMetas[0].name}
        projectId={projectId}
        key={`${projectId}:${path}`}
      />
    </PlasmicRootProvider>
  );
}
