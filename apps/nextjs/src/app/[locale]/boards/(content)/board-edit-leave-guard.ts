const anchorSelector = "a[href]:not([target='_blank'])";

export interface BoardEditLeaveGuard {
  confirmNavigation(href: string): void;
  blockUnload: boolean;
}

const guards = new Set<BoardEditLeaveGuard>();
let listening = false;

const leaveHref = (anchor: HTMLAnchorElement) => {
  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);
  if (destination.origin !== current.origin) return destination.href;
  if (destination.pathname === current.pathname && destination.search === current.search) return null;
  return `${destination.pathname}${destination.search}${destination.hash}`;
};

const handleClick = (event: MouseEvent) => {
  if (guards.size === 0 || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const eventTarget = event.target instanceof Element ? event.target : null;
  const anchor = eventTarget?.closest<HTMLAnchorElement>(anchorSelector);
  if (!anchor || anchor.hasAttribute("download")) return;

  // Cancel the navigation, but let the click reach the anchor. The board switcher
  // closes from that click, and Next.js Link bails out once defaultPrevented is set.
  // Stopping it here is what left the switcher open behind the dialog.
  event.preventDefault();

  const href = leaveHref(anchor);
  if (href === null) return;

  // Both header copies register a guard. Only the first one may open the dialog.
  const guard = guards.values().next().value;
  guard?.confirmNavigation(href);
};

const handlePopState = (event: Event) => {
  if (guards.size === 0) return;
  window.history.pushState(null, document.title, window.location.href);
  event.preventDefault();
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  for (const guard of guards) {
    if (!guard.blockUnload) continue;
    event.preventDefault();
    event.returnValue = true;
    return;
  }
};

const startListening = () => {
  if (listening) return;
  document.addEventListener("click", handleClick, true);
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("beforeunload", handleBeforeUnload);
  listening = true;
};

const stopListening = () => {
  if (!listening) return;
  document.removeEventListener("click", handleClick, true);
  window.removeEventListener("popstate", handlePopState);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  listening = false;
};

// The edit control is mounted for both the desktop and mobile header. One shared
// listener keeps a board switch from opening two discard dialogs.
export const registerBoardEditLeaveGuard = (guard: BoardEditLeaveGuard) => {
  guards.add(guard);
  startListening();

  return () => {
    guards.delete(guard);
    if (guards.size === 0) stopListening();
  };
};
