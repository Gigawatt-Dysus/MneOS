import React from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Square, Minimize2 } from 'lucide-react';
import { useWindowManager, WindowState } from '../../context/WindowManagerContext';

interface WindowProps {
  windowState: WindowState;
}

export const Window: React.FC<WindowProps> = ({ windowState }) => {
  const { id, title, content, x, y, width, height, zIndex, isMinimized, isMaximized } = windowState;
  const { windows, closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateBounds } = useWindowManager();
  const rndRef = React.useRef<any>(null);
  const isMaximizedRef = React.useRef(isMaximized);

  const defaultBounds = React.useMemo(() => ({
    x: isMaximized ? 0 : x,
    y: isMaximized ? 0 : y,
    width: isMaximized ? '100%' : (width === 'auto' ? 600 : width),
    height: isMaximized ? '100%' : (height === 'auto' ? 400 : height),
  }), []); // Empty deps to guarantee it never changes after mount

  React.useEffect(() => {
    if (!rndRef.current) return;
    
    // ONLY force a layout update if the window was explicitly maximized or restored.
    // If we don't guard this, any background re-render will snap the window back to its pre-drag size!
    if (isMaximizedRef.current !== isMaximized) {
      if (isMaximized) {
        rndRef.current.updatePosition({ x: 0, y: 0 });
        rndRef.current.updateSize({ width: '100%', height: '100%' });
      } else {
        rndRef.current.updatePosition({ x, y });
        rndRef.current.updateSize({ width, height });
      }
      isMaximizedRef.current = isMaximized;
    }
  }, [isMaximized, x, y, width, height]);

  if (isMinimized) return null;

  const handleDragStop = (e: any, d: any) => {
    if (isMaximized) return;

    let snappedX = d.x;
    let snappedY = d.y;

    if (e.altKey) {
      updateBounds(id, { x: snappedX, y: snappedY });
      return;
    }

    const PADDING = 10;
    const SNAP_THRESHOLD = 20;

    let minDx = SNAP_THRESHOLD;
    let minDy = SNAP_THRESHOLD;

    const currentWidth = rndRef.current?.resizableElement?.current?.offsetWidth || 600;
    const currentHeight = rndRef.current?.resizableElement?.current?.offsetHeight || 400;

    const otherWindows = windows.filter(w => w.id !== id && !w.isMinimized);

    for (const w of otherWindows) {
      const wRight = w.x + (typeof w.width === 'number' ? w.width : 600);
      const wBottom = w.y + (typeof w.height === 'number' ? w.height : 400);

      const xEdges = [
        { target: w.x - currentWidth - PADDING, distance: Math.abs(d.x - (w.x - currentWidth - PADDING)) },
        { target: wRight + PADDING, distance: Math.abs(d.x - (wRight + PADDING)) },
        { target: w.x, distance: Math.abs(d.x - w.x) }
      ];

      for (const edge of xEdges) {
        if (edge.distance < minDx) {
          minDx = edge.distance;
          snappedX = edge.target;
        }
      }

      const yEdges = [
        { target: w.y - currentHeight - PADDING, distance: Math.abs(d.y - (w.y - currentHeight - PADDING)) },
        { target: wBottom + PADDING, distance: Math.abs(d.y - (wBottom + PADDING)) },
        { target: w.y, distance: Math.abs(d.y - w.y) }
      ];

      for (const edge of yEdges) {
        if (edge.distance < minDy) {
          minDy = edge.distance;
          snappedY = edge.target;
        }
      }
    }

    if (rndRef.current && (snappedX !== d.x || snappedY !== d.y)) {
      rndRef.current.updatePosition({ x: snappedX, y: snappedY });
    }
    updateBounds(id, { x: snappedX, y: snappedY });
  };

  return (
    <Rnd
      ref={rndRef}
      id={`window-frame-${id}`}
      default={defaultBounds}
      onDragStop={handleDragStop}
      onResizeStart={() => focusWindow(id)}
      onResizeStop={(e, direction, ref, delta, position) => {
        updateBounds(id, {
          width: ref.style.width,
          height: ref.style.height,
          ...position,
        });
      }}
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      minWidth={300}
      minHeight={200}
      dragHandleClassName="window-drag-handle"
      className="absolute overflow-hidden rounded-lg shadow-2xl bg-black/60 backdrop-blur-xl border border-cyan-900/30 flex flex-col"
      style={{ zIndex }}
    >
      {/* Title Bar */}
      <div
        className="window-drag-handle flex items-center justify-between px-3 py-2 bg-cyan-950/40 border-b border-cyan-900/50 cursor-grab active:cursor-grabbing select-none"
        onDoubleClick={() => toggleMaximize(id)}
        onMouseDown={() => focusWindow(id)}
        title="Drag to move. Hold Alt to disable magnetic snapping. Double-click to maximize."
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="text-cyan-400 text-xs tracking-widest font-semibold uppercase">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize(id); }}
            className="p-1 text-cyan-600 hover:text-cyan-300 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMaximize(id); }}
            className="p-1 text-cyan-600 hover:text-cyan-300 transition-colors"
          >
            {isMaximized ? <Minimize2 size={14} /> : <Square size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize(id); }}
            className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"
            title="Close Window"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden relative custom-scrollbar" onMouseDown={() => focusWindow(id)}>
        {content}
      </div>
    </Rnd>
  );
};
