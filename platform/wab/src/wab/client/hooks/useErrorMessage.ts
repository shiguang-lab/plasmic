import { showError } from "@/wab/client/ErrorNotifications";
import { useEffect } from "react";

/** Present a request failure once when its error changes, without replacing content. */
export function useErrorMessage(error: unknown, title?: string) {
  useEffect(() => {
    if (error) {
      showError(error, { title });
    }
  }, [error, title]);
}
