import { DataSourceError } from "@/wab/shared/data-sources-meta/data-sources";
import { AxiosResponse } from "axios";
import { isEmpty, isString } from "lodash";

export function base64StringToBuffer(bstr: string) {
  try {
    bstr = atob(bstr);
  } catch (e) {
    throw new DataSourceError("Invalid base64 for binary type");
  }
  const uint8Array = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    uint8Array[i] = bstr.charCodeAt(i);
  }
  return uint8Array.buffer;
}

/**
 * Parse an untrusted HTTP/GraphQL Axios response into structured data or throw DataSourceError.
 */
export async function processHttpResult(res: AxiosResponse<string>) {
  let processedResponse: string | any = res.data;
  const statusCode = res.status;
  try {
    processedResponse = JSON.parse(processedResponse);
  } catch {}
  if (statusCode >= 400) {
    throw new DataSourceError(
      isString(processedResponse) || !isEmpty(processedResponse)
        ? processedResponse
        : undefined,
      statusCode,
    );
  }
  return {
    data: {
      response: processedResponse,
      statusCode,
      headers: { ...res.headers },
    },
  };
}
