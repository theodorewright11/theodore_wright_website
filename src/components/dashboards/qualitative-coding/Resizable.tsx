import { useRef } from 'react';

type Side = 'left' | 'right';
type Edge = 'top' | 'bottom';

type Props = {
  side: Side;
  width: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
};

type RowProps = {
  edge: Edge;
  height: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
};

export function RowResizeHandle({ edge, height, min, max, onChange }: RowProps) {
  const startY = useRef(0);
  const startH = useRef(0);
  const dragging = useRef(false);

  const onMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    const dy = e.clientY - startY.current;
    // edge='top' means the handle is at the top of the resizable element;
    // dragging up makes it bigger (height grows as dy is negative).
    const next = edge === 'top' ? startH.current - dy : startH.current + dy;
    onChange(Math.max(min, Math.min(max, next)));
  };

  const onUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startY.current = e.clientY;
    startH.current = height;
    dragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onDown}
      className="absolute left-0 right-0 h-1.5 cursor-row-resize z-20 hover:bg-blue-400/40 transition-colors"
      style={edge === 'top' ? { top: -3 } : { bottom: -3 }}
      role="separator"
      aria-orientation="horizontal"
      title="drag to resize"
    />
  );
}

export function ResizeHandle({ side, width, min, max, onChange }: Props) {
  const startX = useRef(0);
  const startW = useRef(0);
  const dragging = useRef(false);

  const onMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const next = side === 'left' ? startW.current - dx : startW.current + dx;
    onChange(Math.max(min, Math.min(max, next)));
  };

  const onUp = () => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = width;
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onDown}
      className="absolute top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-blue-400/40 transition-colors"
      style={side === 'left' ? { left: -3 } : { right: -3 }}
      role="separator"
      aria-orientation="vertical"
      title="drag to resize"
    />
  );
}
