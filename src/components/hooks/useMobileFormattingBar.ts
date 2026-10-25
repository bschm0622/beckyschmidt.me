import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';

// Floats the bar via the visual viewport instead of `sticky`, which flickers with the iOS keyboard.
export function useMobileFormattingBar(active: boolean) {
  const [isMobile, setIsMobile] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  // Bar `top` is written to the DOM, not state: re-rendering on scroll feeds a CodeMirror scroll loop.
  const barRef = useRef<HTMLDivElement | null>(null);
  const editorBoxRef = useRef<HTMLDivElement | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const positionBar = useCallback(() => {
    const vv = window.visualViewport;
    const bar = barRef.current;
    if (!vv || !bar) return;
    const top = vv.offsetTop;
    const editorTop = editorBoxRef.current?.getBoundingClientRect().top;
    const minTop = editorTop === undefined ? top : editorTop - bar.offsetHeight;
    bar.style.top = `${Math.round(Math.max(top, minTop))}px`;
  }, []);

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

  // Delayed blur so tapping a toolbar button (which briefly steals focus) doesn't drop the bar.
  const handleEditorFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setEditorFocused(true);
  }, []);
  const handleEditorBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setEditorFocused(false), 150);
  }, []);

  const barFloating = isMobile && editorFocused && active;

  useEffect(() => {
    if (barFloating) positionBar();
  }, [barFloating, positionBar]);

  // On mobile, CodeMirror's caret scrolling fights iOS Safari's and the view jumps; let Safari scroll alone.
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;
  const suppressCmScroll = useMemo(() => EditorView.scrollHandler.of(() => isMobileRef.current), []);

  return { barRef, editorBoxRef, barFloating, handleEditorFocus, handleEditorBlur, suppressCmScroll };
}
