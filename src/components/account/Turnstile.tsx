"use client";

import { useEffect, useRef } from "react";

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void;
  resetSignal: number;
};

export function TurnstileWidget({ onToken, resetSignal }: TurnstileWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!turnstileSiteKey || !hostRef.current) {
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !hostRef.current || !window.turnstile || widgetId.current) {
        return;
      }
      widgetId.current = window.turnstile.render(hostRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile]",
    );
    if (existing) {
      if (window.turnstile) {
        render();
      } else {
        existing.addEventListener("load", render);
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.turnstile = "true";
      script.addEventListener("load", render);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (resetSignal === 0 || !widgetId.current || !window.turnstile) {
      return;
    }
    window.turnstile.reset(widgetId.current);
    onTokenRef.current(null);
  }, [resetSignal]);

  if (!turnstileSiteKey) {
    return null;
  }

  return <div ref={hostRef} className="min-h-16" />;
}
