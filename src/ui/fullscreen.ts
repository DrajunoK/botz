/**
 * In a browser tab (not an installed PWA), hides the browser chrome and locks landscape on the
 * first tap: both need a user gesture. Unsupported browsers (iPhone Safari) are left alone.
 */
export function enterFullscreenOnFirstTap(): void {
  const installed = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  if (installed || !document.fullscreenEnabled) return;

  window.addEventListener(
    "pointerup",
    () => {
      void (async () => {
        try {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
          // `lock` is missing from TypeScript's DOM typings.
          await (screen.orientation as ScreenOrientation & { lock(o: string): Promise<void> }).lock("landscape");
        } catch {
          // Best effort: the game works the same without fullscreen or orientation lock.
        }
      })();
    },
    { once: true },
  );
}
