import { useRef } from 'react';

type Side = 'left' | 'right';

type Props = {
  side: Side;
  width: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
};

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
