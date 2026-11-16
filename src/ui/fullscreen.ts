/**
 * Fullscreen helpers for browser tabs (hides the URL bar, locks landscape). An installed PWA is
 * already fullscreen via its manifest, and iPhone Safari has no fullscreen API: in both cases the
 * feature is reported as unavailable so the UI can hide its button.
 */
type LockableOrientation = ScreenOrientation & { lock(orientation: string): Promise<void> };

export function fullscreenAvailable(): boolean {
  const installed = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  return document.fullscreenEnabled && !installed;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Must be called from a user gesture (a tap). Best effort: the game works the same without it. */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      screen.orientation.unlock();
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      await (screen.orientation as LockableOrientation).lock("landscape");
    }
  } catch {
    // Refused by the browser (no gesture, unsupported orientation lock…): stay as we are.
  }
}
