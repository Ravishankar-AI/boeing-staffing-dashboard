"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page's server data every `seconds` while the tab is
 * visible, so a dashboard left open picks up teammates' changes without a
 * manual reload. Form state and scroll position are kept. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
