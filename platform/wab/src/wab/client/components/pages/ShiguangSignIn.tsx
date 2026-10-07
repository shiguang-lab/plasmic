import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import { Button } from "antd";
import * as React from "react";
import { useEffect } from "react";

export function ShiguangSignIn() {
  const continueTo =
    new URLSearchParams(window.location.search).get("continueTo") ?? "/";
  const target = new URL(continueTo, window.location.origin);
  const returnTo =
    target.origin === window.location.origin && target.pathname !== "/login"
      ? target.href
      : window.location.origin + "/";
  const loginUrl = getShiguangSignInUrl(returnTo);
  useEffect(() => {
    window.location.replace(loginUrl);
  }, [loginUrl]);
  return (
    <Button type="primary" href={loginUrl}>
      Sign in with Shiguang
    </Button>
  );
}
