import { registerSW } from "virtual:pwa-register";

/** How often an open game looks for a new deployment, besides every time it comes back to the foreground. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and, when a new version has been downloaded, shows a toast
 * offering to reload. Without it an installed PWA keeps serving the old version until it is
 * fully closed and reopened.
 */
export function watchForUpdates(): void {
  const applyUpdate = registerSW({
    onNeedRefresh: () => showToast(() => void applyUpdate(true)),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      const check = (): void => void registration.update().catch(() => undefined); // offline: try again later
      window.setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
}

function showToast(onReload: () => void): void {
  const toast = document.createElement("div");
  toast.className = "update-toast";
  toast.setAttribute("role", "status");

  const message = document.createElement("span");
  message.textContent = "Nouvelle version disponible";

  const reload = document.createElement("button");
  reload.textContent = "Recharger";
  reload.addEventListener("click", () => {
    reload.disabled = true;
    reload.textContent = "…";
    onReload();
    // The service worker normally reloads the page once it takes over; if that never happens, do it by hand.
    window.setTimeout(() => window.location.reload(), 3000);
  });

  const dismiss = document.createElement("button");
  dismiss.className = "ghost";
  dismiss.setAttribute("aria-label", "Plus tard");
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", () => toast.remove());

  // The game listens to the whole window: without this, a tap on the toast also presses whatever
  // game button sits under it, and the toast feels like it misses.
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"]) {
    toast.addEventListener(type, (e) => e.stopPropagation());
  }

  toast.append(message, reload, dismiss);
  document.body.append(toast);
}
