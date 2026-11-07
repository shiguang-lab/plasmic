/*
  Forked from https://github.com/vercel/commerce/tree/main/packages/commerce/src
  Changes: Replaced useSWR for useMutablePlasmicQueryData and add provider to useData
*/
import { useMutablePlasmicQueryData } from "@plasmicapp/query";
import { Provider } from "../commerce";
import { CommerceError } from "./errors";
import type {
  Fetcher,
  HookFetcherFn,
  HookFetcherOptions,
  HookFetchInput,
  HookSWRInput,
  SWRHookSchemaBase,
  SwrOptions,
} from "./types";

export type ResponseState<Result> = ReturnType<typeof useMutablePlasmicQueryData<Result, CommerceError>>;

export type UseData = <H extends SWRHookSchemaBase>(
  options: {
    fetchOptions: HookFetcherOptions;
    fetcher: HookFetcherFn<H>;
  },
  input: HookFetchInput | HookSWRInput,
  fetcherFn: Fetcher,
  swrOptions?: SwrOptions<H["data"], H["fetcherInput"]>,
  provider?: Provider
) => ResponseState<H["data"]>;

const useData: UseData = (options, input, fetcherFn, swrOptions, provider) => {
  const hookInput = Array.isArray(input) ? input : Object.entries(input);
  const fetcher = async (
    url: string,
    query?: string,
    method?: string,
    ...args: any[]
  ) => {
    try {
      return await options.fetcher({
        options: { url, query, method },
        // Transform the input array into an object
        input: args.reduce((obj, val, i) => {
          obj[hookInput[i][0]!] = val;
          return obj;
        }, {}),
        fetch: fetcherFn,
        provider
      });
    } catch (error) {
      // SWR will not log errors, but any error that's not an instance
      // of CommerceError is not welcomed by this hook
      if (!(error instanceof CommerceError)) {
        console.error(error);
      }
      throw error;
    }
  };
  const response = useMutablePlasmicQueryData(
    () => {
      const opts = options.fetchOptions;
      return opts
        ? [opts.url, opts.query, opts.method, ...hookInput.map((e) => e[1])]
        : null;
    },
    fetcher,
    swrOptions
  );

  return response;
};

export default useData;
