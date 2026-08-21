import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';

// Mobile formatting bar. On phones, page-level `sticky top-0` fights the caret
// scroll + keyboard resize on iOS and flickers. Instead we keep a SINGLE scroll
// area (the page) and, while the editor is focused, float the bar at the TOP of
// the visible area by tracking the visual viewport. The caret sits at the
// bottom (just above the keyboard), so a top bar never overlaps it.
//
// `active` gates floating to the writing surface (i.e. the Write tab).
export function useMobileFormattingBar(active: boolean) {
  const [isMobile, setIsMobile] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  // The floating bar is positioned by writing its `top` directly to the DOM (see
  // positionBar) rather than through React state — so scrolling never triggers a
  // re-render, which is what could feed back into CodeMirror and cause a scroll
  // loop. Refs, not state, for exactly that reason.
  const barRef = useRef<HTMLDivElement | null>(null);
  const editorBoxRef = useRef<HTMLDivElement | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we're on a phone-width screen (drives the bottom-pinned bar).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Put the bar at the top of the visible area (visual-viewport offset), clamped
  // to the editor's own top so it never rides up over the details. Writes `top`
  // straight to the DOM — no React state, so scrolling can't re-render us.
  const positionBar = useCallback(() => {
    const vv = window.visualViewport;
    const bar = barRef.current;
    if (!vv || !bar) return;
    const top = vv.offsetTop;
    const editorTop = editorBoxRef.current?.getBoundingClientRect().top ?? top;
    bar.style.top = `${Math.round(Math.max(top, editorTop))}px`;
  }, []);

  // Reposition on visual-viewport resize + scroll (iOS fires these as the
  // keyboard animates) and window scroll (the editor's top moves as the page
  // scrolls), coalesced to one measurement per frame.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        positionBar();
      });
    };
    vv.addEventListener('resize', onScroll);
    vv.addEventListener('scroll', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', onScroll);
      vv.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [positionBar]);

  // Focus tracking for the bottom bar. Delay the blur so tapping a toolbar
  // button (which briefly steals focus) doesn't drop and re-pin the bar.
  const handleEditorFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setEditorFocused(true);
  }, []);
  const handleEditorBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setEditorFocused(false), 150);
  }, []);

  // Float the formatting bar above the keyboard only on a focused phone editor.
  const barFloating = isMobile && editorFocused && active;

  // Position it the moment it appears (on focus), before the first paint jump.
  useEffect(() => {
    if (barFloating) positionBar();
  }, [barFloating, positionBar]);

  // On mobile, suppress CodeMirror's own "scroll caret into view" and let iOS
  // handle keeping the caret visible. CM scrolls the window on every keystroke;
  // on iOS that fights Safari's native caret scrolling and the two oscillate —
  // the view jumps over and over while typing a long paragraph. Returning true
  // from the scroll handler tells CM it's handled, so it does nothing, leaving a
  // single (native) scroller. Desktop keeps CM's scrolling. Read isMobile through
  // a ref so the facet stays stable.
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;
  const suppressCmScroll = useMemo(() => EditorView.scrollHandler.of(() => isMobileRef.current), []);

  return { barRef, editorBoxRef, barFloating, handleEditorFocus, handleEditorBlur, suppressCmScroll };
}
