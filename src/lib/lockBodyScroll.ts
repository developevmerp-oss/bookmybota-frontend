/** Prevents page/navbar horizontal jump when modals hide the scrollbar. */
export function lockBodyScroll(): () => void {
  const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const prevOverflow = document.body.style.overflow;
  const prevPaddingRight = document.body.style.paddingRight;
  document.body.style.overflow = "hidden";
  if (scrollbar > 0) {
    document.body.style.paddingRight = `${scrollbar}px`;
  }
  return () => {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  };
}
