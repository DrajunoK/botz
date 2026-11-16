/**
 * Fullscreen helpers for browser tabs (hides the URL bar, locks landscape). An installed PWA is
 * already fullscreen via its manifest, and iPhone Safari has no fullscreen API: in both cases the
 * feature is reported as unavailable so the UI can hide its button.
 */
type LockableOrientation = ScreenOrientation & { lock(orientation: string): Promise<void> };

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export function fullscreenAvailable(): boolean {
  if (!document.fullscreenEnabled) return false;
  // While we are fullscreen ourselves, `display-mode: fullscreen` matches too: it would look
  // like an installed PWA and hide the button needed to leave. Only a manifest-driven display
  // mode leaves `fullscreenElement` null.
  if (isFullscreen()) return true;
  return !window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
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
