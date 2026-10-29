import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import type { PublishedPageProps } from "../../components/PublishedPage";
import { getPublication } from "../../lib/publications";

export default dynamic(() => import("../../components/PublishedPage"), {
  ssr: false,
});

export const getServerSideProps: GetServerSideProps<
  PublishedPageProps
> = async ({ params, res }) => {
  res.setHeader("Cache-Control", "no-store");
  const publication = await getPublication(String(params?.publicationCode));
  if (!publication) {
    return { notFound: true };
  }
  return { props: publication };
};
