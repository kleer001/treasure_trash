// Keyboard focus, for a build that runs inside somebody else's page.
//
// It takes its window at the boundary the way `progress` takes its store, so what it installs can
// be read by a plain object in a test — the failure it exists to prevent only happens inside an
// embed, where no local build reproduces it.

/**
 * `win` is the window to reclaim focus on. Both listeners are needed and neither is redundant:
 * `resize` fires when a frame enters or leaves fullscreen with no click involved, and the capture
 * flag on `pointerdown` puts the reclaim ahead of any handler that cancels the press.
 */
export function installFocusReclaim(win) {
  const reclaim = () => win.focus();
  win.addEventListener('resize', reclaim);
  win.addEventListener('pointerdown', reclaim, true);
}
