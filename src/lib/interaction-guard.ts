const passiveFalse: AddEventListenerOptions = { passive: false };

function preventDefault(event: Event): void {
  event.preventDefault();
}

function preventMultiTouch(event: TouchEvent): void {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}

export function installInteractionGuard(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  window.addEventListener("gesturestart", preventDefault, passiveFalse);
  window.addEventListener("gesturechange", preventDefault, passiveFalse);
  window.addEventListener("gestureend", preventDefault, passiveFalse);
  document.addEventListener("touchstart", preventMultiTouch, passiveFalse);
  document.addEventListener("touchmove", preventMultiTouch, passiveFalse);
  document.addEventListener("dblclick", preventDefault, passiveFalse);
  document.addEventListener("contextmenu", preventDefault, passiveFalse);

  return () => {
    window.removeEventListener("gesturestart", preventDefault);
    window.removeEventListener("gesturechange", preventDefault);
    window.removeEventListener("gestureend", preventDefault);
    document.removeEventListener("touchstart", preventMultiTouch);
    document.removeEventListener("touchmove", preventMultiTouch);
    document.removeEventListener("dblclick", preventDefault);
    document.removeEventListener("contextmenu", preventDefault);
  };
}

