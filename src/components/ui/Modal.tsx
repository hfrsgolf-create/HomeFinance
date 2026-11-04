import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';
import { skipNextPopstate } from '../../lib/popstateSkip';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

interface Pos { x: number; y: number; }

const Z_OVERLAY = 1000;
const Z_PANEL = 1001;
const EDGE_MARGIN = 8;

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ sX: number; sY: number; bX: number; bY: number } | null>(null);
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset to centered on open
  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
    setDragging(false);
    dragState.current = null;
  }, [open]);

  // Push a history entry when the modal opens so Android back closes it.
  // onClose is kept in a ref so this effect runs only once per open, not on
  // every keystroke that re-renders the parent with a new inline callback.
  useEffect(() => {
    if (!open) return;
    pushedRef.current = true;
    window.history.pushState(null, '');
    const onPop = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedRef.current) {
        pushedRef.current = false;
        skipNextPopstate();
        window.history.back();
      }
    };
  }, [open]);

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const clamp = useCallback((x: number, y: number): Pos => {
    const panel = panelRef.current;
    if (!panel) return { x, y };
    const rect = panel.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const maxX = window.innerWidth / 2 - w / 2 - EDGE_MARGIN;
    const maxY = window.innerHeight / 2 - h / 2 - EDGE_MARGIN;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const startDrag = useCallback((cx: number, cy: number) => {
    dragState.current = { sX: cx, sY: cy, bX: pos.x, bY: pos.y };
    setDragging(true);
  }, [pos]);

  const moveDrag = useCallback((cx: number, cy: number) => {
    if (!dragState.current) return;
    setPos(clamp(dragState.current.bX + (cx - dragState.current.sX), dragState.current.bY + (cy - dragState.current.sY)));
  }, [clamp]);

  const endDrag = useCallback(() => {
    dragState.current = null;
    setDragging(false);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
    const move = (ev: MouseEvent) => moveDrag(ev.clientX, ev.clientY);
    const up = () => {
      endDrag();
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [startDrag, moveDrag, endDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
    const move = (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      const t2 = ev.touches[0];
      moveDrag(t2.clientX, t2.clientY);
    };
    const end = () => {
      endDrag();
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }, [startDrag, moveDrag, endDrag]);

  if (!open) return null;

  const maxW = size === 'sm' ? '24rem' : size === 'lg' ? '42rem' : '32rem';

  // Portal: render directly into document.body, escaping all page containers
  return createPortal(
    <>
      {/* Full-screen dimmed overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="animate-modal-in"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: Z_OVERLAY,
        }}
      />
      {/* Modal panel — fixed, centered via transform */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          zIndex: Z_PANEL,
          width: '90vw',
          maxWidth: maxW,
          maxHeight: '90vh',
          touchAction: 'none',
        }}
        className="flex flex-col bg-white dark:bg-ink-900 rounded-2xl shadow-2xl border border-ink-100 dark:border-ink-800 overflow-hidden animate-modal-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Draggable header */}
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className={`flex items-center justify-between px-5 py-4 shrink-0 border-b border-ink-100 dark:border-ink-800 select-none ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal size={16} className="text-ink-300 dark:text-ink-600 shrink-0 pointer-events-none" />
            <h2 className="font-semibold text-base text-ink-900 dark:text-ink-50 truncate pr-4">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {/* Footer — always reachable */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-ink-100 dark:border-ink-800">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
