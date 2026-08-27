/** Prevents page/navbar horizontal jump when modals hide the scrollbar. */
export function lockBodyScroll(): () => void {
  const html = document.documentElement;
  const prevOverflow = document.body.style.overflow;
  const prevPaddingRight = document.body.style.paddingRight;

  const widthBefore = html.clientWidth;
  document.body.style.overflow = "hidden";
  const shift = Math.max(0, html.clientWidth - widthBefore);
  if (shift > 0) {
    document.body.style.paddingRight = `${shift}px`;
  }

  return () => {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  };
}
