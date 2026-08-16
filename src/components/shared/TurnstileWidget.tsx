import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from "react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT_ID = "serenar-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_STATE_ATTRIBUTE = "data-load-state";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (code?: string) => void;
      theme: "light";
      retry?: "auto" | "never";
      "refresh-expired"?: "auto" | "manual" | "never";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = {
  reset(): void;
};

export type TurnstileWidgetState = "ready" | "expired" | "error" | "initialization-error";

type TurnstileWidgetProps = {
  action?: string;
  onTokenChange(token: string | null): void;
  onAvailabilityChange?(available: boolean): void;
  onStateChange?(state: TurnstileWidgetState): void;
};

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  const currentPromise = new Promise<TurnstileApi>((resolve, reject) => {
    let existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (
      existingScript?.getAttribute(TURNSTILE_SCRIPT_STATE_ATTRIBUTE) === "failed" ||
      (existingScript?.getAttribute(TURNSTILE_SCRIPT_STATE_ATTRIBUTE) === "loaded" &&
        !window.turnstile)
    ) {
      existingScript.remove();
      existingScript = null;
    }

    const script = existingScript ?? document.createElement("script");
    let settled = false;

    function fail() {
      if (settled) return;
      settled = true;
      script.setAttribute(TURNSTILE_SCRIPT_STATE_ATTRIBUTE, "failed");
      script.remove();
      reject(new Error("turnstile_unavailable"));
    }

    function handleLoad() {
      if (window.turnstile) {
        settled = true;
        script.setAttribute(TURNSTILE_SCRIPT_STATE_ATTRIBUTE, "loaded");
        resolve(window.turnstile);
        return;
      }

      fail();
    }

    function handleError() {
      fail();
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute(TURNSTILE_SCRIPT_STATE_ATTRIBUTE, "loading");
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });

  scriptPromise = currentPromise;
  return currentPromise;
}

function updateCallbackRef<T>(ref: RefObject<T>, callback: T): void {
  ref.current = callback;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onTokenChange, onAvailabilityChange, onStateChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const apiRef = useRef<TurnstileApi | null>(null);
    const activeRef = useRef(false);
    const tokenChangeRef = useRef(onTokenChange);
    const availabilityChangeRef = useRef(onAvailabilityChange);
    const stateChangeRef = useRef(onStateChange);

    updateCallbackRef(tokenChangeRef, onTokenChange);
    updateCallbackRef(availabilityChangeRef, onAvailabilityChange);
    updateCallbackRef(stateChangeRef, onStateChange);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          tokenChangeRef.current(null);

          if (apiRef.current && widgetIdRef.current) {
            apiRef.current.reset(widgetIdRef.current);
          }
        },
      }),
      [],
    );

    useEffect(() => {
      activeRef.current = true;

      if (!TURNSTILE_SITE_KEY) {
        availabilityChangeRef.current?.(false);
        return () => {
          activeRef.current = false;
        };
      }

      const siteKey = TURNSTILE_SITE_KEY;

      void loadTurnstileScript()
        .then((api) => {
          if (!activeRef.current || !containerRef.current || widgetIdRef.current) {
            return;
          }

          apiRef.current = api;
          availabilityChangeRef.current?.(true);

          try {
            widgetIdRef.current = api.render(containerRef.current, {
              sitekey: siteKey,
              ...(action ? { action } : {}),
              callback: (token) => {
                if (!activeRef.current) return;
                tokenChangeRef.current(token);
                stateChangeRef.current?.("ready");
              },
              "expired-callback": () => {
                if (!activeRef.current) return;
                tokenChangeRef.current(null);
                stateChangeRef.current?.("expired");
              },
              "error-callback": () => {
                if (!activeRef.current) return;
                tokenChangeRef.current(null);
                stateChangeRef.current?.("error");
                // Evita o loop de novas tentativas quando o domínio não está
                // autorizado no Cloudflare (erro 110200): remove o widget.
                if (apiRef.current && widgetIdRef.current) {
                  apiRef.current.remove(widgetIdRef.current);
                  widgetIdRef.current = null;
                }
                availabilityChangeRef.current?.(false);
              },
              theme: "light",
              retry: "never",
              "refresh-expired": "manual",
            });
          } catch {
            availabilityChangeRef.current?.(false);
            stateChangeRef.current?.("initialization-error");
          }
        })
        .catch(() => {
          if (!activeRef.current) return;
          tokenChangeRef.current(null);
          availabilityChangeRef.current?.(false);
        });

      return () => {
        activeRef.current = false;

        if (apiRef.current && widgetIdRef.current) {
          apiRef.current.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [action]);

    return <div ref={containerRef} />;
  },
);
