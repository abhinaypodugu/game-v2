// Pan/zoom frame around BoardSvg: pinch, drag-pan, wheel and double-tap
// zoom, fit-to-screen on mount/resize, floating zoom controls. Taps on legal
// targets still register; a press that travelled (a pan) is not a tap.

import { useEffect, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { BOARD_COLORS } from '../theme';
import { BoardSvg, type BoardSvgProps } from './BoardSvg';

export interface Board2DProps extends BoardSvgProps {
  /** Positioning classes for the zoom controls (include flex direction); replaces the default right-edge, vertically centred column. */
  controlsClassName?: string;
  /** Padding classes reserving space around the fitted board so floating controls never cover tiles. */
  fitInsetClassName?: string;
}

/** Pointer travel (CSS px) beyond which a press is a pan, not a tap. */
const TAP_SLOP = 10;
const ZOOM_STEP = 0.5;

const BUTTON =
  'grid h-11 w-11 place-items-center rounded-xl bg-white/95 text-[#1f2430] shadow-[0_2px_8px_rgba(0,0,0,0.25)] ring-1 ring-black/10 transition active:scale-95 hover:bg-white';

export function Board2D({ controlsClassName, fitInsetClassName, ...boardProps }: Board2DProps): React.JSX.Element {
  const zoom = useRef<ReactZoomPanPinchContentRef>(null);
  const frame = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);

  // The content is sized to the frame and the SVG letterboxes itself through
  // its viewBox, so "fit" is the identity transform. Re-fit when the frame
  // really changes size (rotation, window resize), ignoring sub-pixel jitter.
  useEffect(() => {
    const el = frame.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    let last = { w: el.clientWidth, h: el.clientHeight };
    let raf = 0;
    const observer = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      if (Math.abs(next.w - last.w) < 2 && Math.abs(next.h - last.h) < 2) return;
      last = next;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => void zoom.current?.resetTransform(0));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={frame}
      className="relative h-full w-full overflow-hidden"
      style={{ background: BOARD_COLORS.ocean }}
      data-testid="board-2d"
      onPointerDownCapture={(e) => {
        press.current = { x: e.clientX, y: e.clientY };
      }}
      onClickCapture={(e) => {
        const start = press.current;
        if (start !== null && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <TransformWrapper
        ref={zoom}
        initialScale={1}
        minScale={0.8}
        maxScale={3}
        limitToBounds
        centerZoomedOut
        doubleClick={{ step: 0.8, excluded: ['bs-hit'] }}
        wheel={{ step: 0.15 }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%', touchAction: 'none' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div className={`box-border h-full w-full ${fitInsetClassName ?? ''}`}>
            <BoardSvg {...boardProps} />
          </div>
        </TransformComponent>
      </TransformWrapper>

      <div className={`absolute z-10 flex gap-2 ${controlsClassName ?? 'flex-col right-2 top-1/2 -translate-y-1/2'}`}>
        <button type="button" className={BUTTON} aria-label="Zoom in" onClick={() => void zoom.current?.zoomIn(ZOOM_STEP)}>
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" className={BUTTON} aria-label="Zoom out" onClick={() => void zoom.current?.zoomOut(ZOOM_STEP)}>
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" className={BUTTON} aria-label="Fit board" onClick={() => void zoom.current?.resetTransform()}>
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
