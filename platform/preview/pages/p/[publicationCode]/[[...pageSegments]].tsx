import { findPreviewPage } from "@plasmic-shared/preview";
import type { ComponentRenderData } from "@plasmicapp/loader-nextjs";
import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import type { PublishedPageProps } from "../../../components/PublishedPage";
import { getPublication } from "../../../lib/publications";

const PublishedPage = dynamic(
  () => import("../../../components/PublishedPage"),
  { ssr: false },
);
export default PublishedPage;

export const getServerSideProps: GetServerSideProps<
  PublishedPageProps
> = async ({ params, resolvedUrl, res }) => {
  res.setHeader("Cache-Control", "no-store");
  const publication = await getPublication(String(params?.publicationCode));
  if (!publication) {
    return { notFound: true };
  }
  const segments = Array.isArray(params?.pageSegments)
    ? params.pageSegments
    : [];
  const path = `/${segments.map(encodeURIComponent).join("/")}`;
  const match = findPreviewPage(publication.pages, path);
  if (!match) {
    return { notFound: true };
  }
  const entry = publication.bundle.components.find(
    (component) => component.id === match.page.id,
  );
  if (!entry) {
    return { notFound: true };
  }
  const pageQuery: PublishedPageProps["pageQuery"] = {};
  const search = new URL(resolvedUrl, "http://preview.local").searchParams;
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    pageQuery[key] = values.length === 1 ? values[0] : values;
  }
  const bundle = {
    ...publication.bundle,
    filteredIds: Object.fromEntries(
      publication.bundle.projects.map((project) => [project.id, []]),
    ),
    deferChunksByDefault: false,
  };
  const data: ComponentRenderData = {
    bundle,
    entryCompMetas: [
      {
        ...entry,
        params: Object.fromEntries(
          Object.entries(match.params).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join("/") : value,
          ]),
        ),
      },
    ],
    remoteFontUrls: bundle.projects.flatMap((project) =>
      project.remoteFonts.map((font) => font.url),
    ),
  };
  return {
    props: {
      code: publication.code,
      projectId: publication.projectId,
      version: publication.version,
      path,
      route: match.page.path,
      pageParams: match.params,
      pageQuery,
      data,
    },
  };
};
