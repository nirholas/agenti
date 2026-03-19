"use client";

import * as React from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

export function CopyToClipboardButton({
  content,
  className,
  ...props
}: {
  content: string;
} & ButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  return (
    <Button
      size="icon"
      variant="outline"
      className={cn(
        "[&_svg]-h-3.5 h-7 w-7 rounded-[6px] [&_svg]:w-3.5",
        className,
      )}
      onClick={() => {
        navigator.clipboard.writeText(content);
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? <CheckIcon /> : <ClipboardIcon />}
    </Button>
  );
}
