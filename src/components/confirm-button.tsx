"use client";

import type { ComponentProps } from "react";
import { Button } from "./ui";

/** form 内で使う確認付き送信ボタン */
export function ConfirmButton({
  message,
  ...props
}: ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
