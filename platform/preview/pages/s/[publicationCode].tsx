import { publicationPath } from "@plasmic-shared/preview";
import type { GetServerSideProps } from "next";
import { getPublication } from "../../lib/publications";

export default function ShortLink() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({
  params,
  resolvedUrl,
  res,
}) => {
  res.setHeader("Cache-Control", "no-store");
  const publication = await getPublication(String(params?.publicationCode));
  if (!publication) {
    return { notFound: true };
  }
  const search = new URL(resolvedUrl, "http://preview.local").search;
  return {
    redirect: {
      destination:
        publicationPath(publication.code, publication.entryPath) + search,
      permanent: false,
    },
  };
};
