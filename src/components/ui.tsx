import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({ src, size = 24, title, fallback }: { src?: string; size?: number; title?: string; fallback?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [src]);
  const letter = (fallback || title || '?').slice(0, 1).toUpperCase();
  return (
    <span className="avatar" title={title} style={{ width: size, height: size }}>
      {src && !failed ? (
        <div style={{ backgroundImage: `url("${src}")` }} />
      ) : (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            fontSize: Math.round(size * 0.45),
            fontWeight: 600,
            background: 'linear-gradient(135deg,#ec9513,#c0438f)',
          }}
        >
          {letter}
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

type Side = 'top' | 'right' | 'bottom' | 'left';

export function Tooltip({ label, side = 'top', children, delay = 300 }: { label: ReactNode; side?: Side; children: ReactElement<any>; delay?: number }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (e: React.MouseEvent | React.FocusEvent) => {
    const el = e.currentTarget as HTMLElement;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRect(el.getBoundingClientRect()), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setRect(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  let style: CSSProperties = {};
  if (rect) {
    const gap = 8;
    if (side === 'right') style = { left: rect.right + gap, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
    if (side === 'left') style = { right: window.innerWidth - rect.left + gap, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
    if (side === 'top') style = { left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + gap, transform: 'translateX(-50%)' };
    if (side === 'bottom') style = { left: rect.left + rect.width / 2, top: rect.bottom + gap, transform: 'translateX(-50%)' };
  }

  const child = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      show(e);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show(e);
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      children.props.onBlur?.(e);
    },
    onClick: (e: React.MouseEvent) => {
      hide();
      children.props.onClick?.(e);
    },
  });

  return (
    <>
      {child}
      {rect && createPortal(<div className="tooltip" style={style} role="tooltip">{label}</div>, document.body)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Popover / dropdown menu                                             */
/* ------------------------------------------------------------------ */

type Align = 'start' | 'end' | 'center';

export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = useCallback((el: HTMLElement) => setAnchor(el), []);
  const close = useCallback(() => setAnchor(null), []);
  const toggle = useCallback((el: HTMLElement) => setAnchor((a) => (a ? null : el)), []);
  return { anchor, open, close, toggle, isOpen: !!anchor };
}

export function Popover({
  anchor,
  onClose,
  children,
  side = 'bottom',
  align = 'start',
  offset = 6,
  width,
  className = 'menu',
  style,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  side?: Side;
  align?: Align;
  offset?: number;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    let left = 0;
    let top = 0;
    if (side === 'bottom' || side === 'top') {
      top = side === 'bottom' ? r.bottom + offset : r.top - m.height - offset;
      left = align === 'start' ? r.left : align === 'end' ? r.right - m.width : r.left + r.width / 2 - m.width / 2;
    } else {
      left = side === 'right' ? r.right + offset : r.left - m.width - offset;
      top = align === 'start' ? r.top : align === 'end' ? r.bottom - m.height : r.top + r.height / 2 - m.height / 2;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - m.height - 8));
    setPos({ left, top });
  }, [anchor, side, align, offset]);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;
  return createPortal(
    <div ref={ref} className={className} style={{ ...pos, width, ...style }} role="menu">
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function Dialog({
  open,
  onClose,
  children,
  style,
  className = 'dialog',
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  label?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onMouseDown={onClose} />
      <div className={className} style={style} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Global UI state (command palette, toasts)                          */
/* ------------------------------------------------------------------ */

interface UIState {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  toast: (msg: string) => void;
}

const UICtx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <UICtx.Provider value={{ paletteOpen, setPaletteOpen, toast }}>
      {children}
      {createPortal(
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.msg}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </UICtx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UICtx);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}
