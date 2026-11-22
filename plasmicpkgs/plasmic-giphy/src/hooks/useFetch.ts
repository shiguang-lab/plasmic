import { useEffect, useState } from "react";

interface HookProps {
  keyword: string;
  apiKey?: string;
}

export const useFetch = ({
  keyword,
  apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "",
}: HookProps) => {
  const [giphyId, setGiphyId] = useState("");
  useEffect(() => {
    let active = true;
    if (!keyword) {
      return;
    }
    const fetchGiphy = async () => {
      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          q: keyword,
          limit: "1",
        });
        const response = await fetch(
          `https://api.giphy.com/v1/gifs/search?${params.toString()}`
        );
        const { data } = await response.json();
        if (active) {
          setGiphyId(data[0]?.id);
        }
      } catch (error) {
        if (active) {
          console.error("Error in gif api retrieval: ", error);
          setGiphyId("");
        }
      }
    };
    void fetchGiphy();
    return () => {
      active = false;
    };
  }, [keyword, apiKey]);
  return giphyId;
};
