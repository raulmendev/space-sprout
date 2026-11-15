/**
 * The on-screen keyboard shrinks the page (the Android app's WebView, and phone browsers with
 * `interactive-widget=resizes-content`). The game must not reflow under it: the room, the top
 * bar and the controls keep the height they had before it opened, and only what is being typed
 * into moves up into the space left above the keyboard.
 *
 * Sets on <html>:
 * - `--stage-h`: the screen height without the keyboard (what the game is laid out in);
 * - class `keyboard-open` while the keyboard covers part of the screen (popups go compact).
 * `100dvh` keeps meaning the space actually visible.
 */

/** A shrink this large while typing is the keyboard, not the browser's toolbar. */
const KEYBOARD_MIN_PX = 100;

export function watchKeyboard(): void {
  const root = document.documentElement;
  let stageW = window.innerWidth;
  let stageH = window.innerHeight;

  const update = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const open = w === stageW && isTyping() && h < stageH - KEYBOARD_MIN_PX;
    if (!open) {
      stageW = w;
      stageH = h;
    }
    root.style.setProperty('--stage-h', `${stageH}px`);
    root.classList.toggle('keyboard-open', open);
  };

  window.addEventListener('resize', update);
  update();
}

/** Is focus somewhere the keyboard types into? */
function isTyping(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}
