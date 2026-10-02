"use client";

import { useEffect } from "react";
import { SiteErrorPanel } from "@/components/layout/SiteErrorPanel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <SiteErrorPanel onRetry={reset} />;
}
