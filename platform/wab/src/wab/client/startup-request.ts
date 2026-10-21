import { asApiError } from "@/wab/client/api-error-presentation";
import { asyncTimeout } from "@/wab/shared/common";

// Startup reads can race an IAM session refresh. A temporary service failure
// must not strand startup or be mistaken for an expired login.
export async function retryStartupRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (asApiError(error)?.statusCode !== 503 || attempt === 2) {
        throw error;
      }
      await asyncTimeout(250 * (attempt + 1));
    }
  }
}
