import { useEffect, useState } from "preact/hooks";
import { t } from "../i18n/index.ts";

type InstallState =
  | { type: "native"; fire: () => void }
  | { type: "instructions"; message: string }
  | null;

/** Running as the installed app. */
export function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** The browser's install prompt, which fires once per page load, wherever that is. */
let installPrompt: Event | null = null;
const promptListeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  for (const listener of promptListeners) listener();
});

function nativeInstall(prompt: Event): InstallState {
  return {
    type: "native",
    fire: () => {
      if ("prompt" in prompt && typeof prompt.prompt === "function") prompt.prompt();
    },
  };
}

/** How this browser installs the app: its own prompt, written steps, or neither. */
export function useInstall(): InstallState {
  const s = t();
  const [state, setState] = useState<InstallState>(() => {
    if (isInstalled()) return null;
    if (installPrompt) return nativeInstall(installPrompt);
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return { type: "instructions", message: s.install.iosSafari };
    if (/Android/.test(ua) && /Firefox/.test(ua)) {
      return { type: "instructions", message: s.install.androidFirefox };
    }
    return null;
  });

  useEffect(() => {
    if (isInstalled()) return undefined;
    const onPrompt = () => {
      if (installPrompt) setState(nativeInstall(installPrompt));
    };
    promptListeners.add(onPrompt);
    return () => {
      promptListeners.delete(onPrompt);
    };
  }, []);

  return state;
}
