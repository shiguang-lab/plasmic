import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { codegenTypeKey } from "@/wab/client/LocalStorageKey";
import { mkUuid, spawn } from "@/wab/shared/common";
import { proxy } from "comlink";
import { useEffect, useState } from "react";

/**
 * Returns the user's last selected codegenType. Listen to changes in
 * Docs portal's localStorage and updates the value accordingly.
 */
export function useCodegenType(): "loader" | "codegen" {
  const { api } = useAppCtx();
  const [codegenType, setCodegenType] = useState<"loader" | "codegen">(
    "codegen",
  );

  useEffect(() => {
    let active = true;
    spawn(
      Promise.resolve(api.getStorageItem(codegenTypeKey)).then(
        (storedCodegenType: any) => {
          if (active && storedCodegenType) {
            setCodegenType(storedCodegenType as any);
          }
        },
      ),
    );
    const uniqueId = mkUuid();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    api.addStorageListener(
      uniqueId,
      proxy(({ key, newValue }) => {
        if (active && key === codegenTypeKey && newValue) {
          setCodegenType(newValue as any);
        }
      }),
    );
    return () => {
      active = false;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      api.removeEventListener("storage", uniqueId);
    };
  }, [api]);
  return codegenType;
}
