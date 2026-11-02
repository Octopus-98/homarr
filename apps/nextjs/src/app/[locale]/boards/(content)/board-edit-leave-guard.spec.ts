// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerBoardEditLeaveGuard } from "./board-edit-leave-guard";
import type { BoardEditLeaveGuard } from "./board-edit-leave-guard";

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/en/boards/home");
});

const register = (confirmNavigation: BoardEditLeaveGuard["confirmNavigation"], blockUnload = false) => {
  cleanups.push(registerBoardEditLeaveGuard({ confirmNavigation, blockUnload }));
};

const clickLink = (link: HTMLAnchorElement) => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(event);
  return event;
};

describe("board edit leave guard", () => {
  it("asks once and still delivers the click when edit mode is mounted twice", () => {
    window.history.replaceState(null, "", "/en/boards/home");
    const firstConfirm = vi.fn();
    const secondConfirm = vi.fn();
    register(firstConfirm);
    register(secondConfirm);

    const link = document.createElement("a");
    link.href = "/en/boards/other";
    link.textContent = "Other";
    const optionClick = vi.fn();
    link.addEventListener("click", optionClick);
    document.body.append(link);

    const event = clickLink(link);

    expect(event.defaultPrevented).toBe(true);
    expect(optionClick).toHaveBeenCalledTimes(1);
    expect(firstConfirm).toHaveBeenCalledTimes(1);
    expect(firstConfirm).toHaveBeenCalledWith("/en/boards/other");
    expect(secondConfirm).not.toHaveBeenCalled();
  });

  it("closes a same-board link without asking to discard", () => {
    window.history.replaceState(null, "", "/en/boards/home");
    const confirmNavigation = vi.fn();
    register(confirmNavigation);
    const link = document.createElement("a");
    link.href = "/en/boards/home";
    const optionClick = vi.fn();
    link.addEventListener("click", optionClick);
    document.body.append(link);

    const event = clickLink(link);

    expect(event.defaultPrevented).toBe(true);
    expect(optionClick).toHaveBeenCalledTimes(1);
    expect(confirmNavigation).not.toHaveBeenCalled();
  });

  it("leaves modified clicks and new tabs alone", () => {
    const confirmNavigation = vi.fn();
    register(confirmNavigation);
    const link = document.createElement("a");
    link.href = "/en/boards/other";
    document.body.append(link);

    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    link.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);

    const blank = document.createElement("a");
    blank.href = "/en/boards/other";
    blank.target = "_blank";
    document.body.append(blank);
    const blankClick = clickLink(blank);
    expect(blankClick.defaultPrevented).toBe(false);
    expect(confirmNavigation).not.toHaveBeenCalled();
  });

  it("confirms an external same-tab link with its absolute address", () => {
    const confirmNavigation = vi.fn();
    register(confirmNavigation);
    const link = document.createElement("a");
    link.href = "https://example.com/service";
    document.body.append(link);

    clickLink(link);

    expect(confirmNavigation).toHaveBeenCalledWith("https://example.com/service");
  });

  it("pushes history back once when several edit menus are mounted", () => {
    register(vi.fn());
    register(vi.fn());
    const pushState = vi.spyOn(window.history, "pushState");

    try {
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(pushState).toHaveBeenCalledTimes(1);
    } finally {
      pushState.mockRestore();
    }
  });

  it("stops intercepting after the last edit menu unmounts", () => {
    const confirmNavigation = vi.fn();
    const remove = registerBoardEditLeaveGuard({ confirmNavigation, blockUnload: false });
    cleanups.push(remove);
    remove();
    const link = document.createElement("a");
    link.href = "/en/boards/other";
    document.body.append(link);

    const event = clickLink(link);

    expect(event.defaultPrevented).toBe(false);
    expect(confirmNavigation).not.toHaveBeenCalled();
  });
});
