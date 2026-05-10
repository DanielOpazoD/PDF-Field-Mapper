import React, { useState, useRef } from 'react';
import { generateId } from '../utils/pdfUtils';
import { Toolbar } from './Toolbar';
import { usePdf } from '../contexts/PdfContext';

export const DrawingOverlay: React.FC = () => {
  const {
    fields,
    currentPage,
    onAddField,
    selectedFieldIds,
    setSelectedFieldIds,
    onUpdateFields,
    onDeleteFields,
    zoom,
    setZoom,
    mode
  } = usePdf();

  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLasso, setIsLasso] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    initialPositions: { id: string; x: number; y: number; width: number; height: number }[];
    mainFieldId: string;
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    id: string;
    handle: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  } | null>(null);

  const [snapLineY, setSnapLineY] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'hand') return;
    if (e.target !== overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    
    if (mode === 'draw') {
      setIsDrawing(true);
    } else {
      setIsLasso(true);
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setSelectedFieldIds([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (resizeState) {
      const deltaX = ((e.clientX - resizeState.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeState.startY) / rect.height) * 100;
      
      let { initialX, initialY, initialWidth, initialHeight } = resizeState;
      let newX = initialX;
      let newY = initialY;
      let newWidth = initialWidth;
      let newHeight = initialHeight;

      if (resizeState.handle.includes('e')) newWidth = Math.max(0.5, initialWidth + deltaX);
      if (resizeState.handle.includes('s')) newHeight = Math.max(0.5, initialHeight + deltaY);
      if (resizeState.handle.includes('w')) {
        const potentialWidth = initialWidth - deltaX;
        if (potentialWidth > 0.5) {
          newWidth = potentialWidth;
          newX = initialX + deltaX;
        }
      }
      if (resizeState.handle.includes('n')) {
        const potentialHeight = initialHeight - deltaY;
        if (potentialHeight > 0.5) {
          newHeight = potentialHeight;
          newY = initialY + deltaY;
        }
      }

      onUpdateFields([{ id: resizeState.id, x: newX, y: newY, width: newWidth, height: newHeight } as any]);
      return;
    }

    if (dragState) {
      const deltaX = ((e.clientX - dragState.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragState.startY) / rect.height) * 100;

      const updates: { id: string; x: number; y: number }[] = [];
      const mainFieldInitial = dragState.initialPositions.find(p => p.id === dragState.mainFieldId)!;
      let mainNewY = mainFieldInitial.y + deltaY;
      
      const snapMarginYPct = (5 / rect.height) * 100;
      let snapped = false;
      
      for (const otherField of fields) {
        if (!selectedFieldIds.includes(otherField.id) && otherField.page === currentPage) {
          if (Math.abs(mainNewY - otherField.y) <= snapMarginYPct) {
            mainNewY = otherField.y;
            setSnapLineY(mainNewY);
            snapped = true;
            break;
          }
        }
      }
      
      if (!snapped) setSnapLineY(null);

      const finalDeltaY = mainNewY - mainFieldInitial.y;

      dragState.initialPositions.forEach(pos => {
        let newX = pos.x + deltaX;
        let newY = pos.y + finalDeltaY;

        newX = Math.max(0, Math.min(100 - pos.width, newX));
        newY = Math.max(0, Math.min(100 - pos.height, newY));

        updates.push({ id: pos.id, x: newX, y: newY });
      });

      onUpdateFields(updates as any);
      return;
    }

    if (isLasso || isDrawing) {
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setCurrentPos({ x, y });

      if (isLasso) {
        const lx = Math.min(startPos.x, x);
        const ly = Math.min(startPos.y, y);
        const lw = Math.abs(x - startPos.x);
        const lh = Math.abs(y - startPos.y);

        const newlySelected = fields
          .filter(f => f.page === currentPage)
          .filter(f => {
            return (
              f.x >= lx &&
              f.y >= ly &&
              f.x + f.width <= lx + lw &&
              f.y + f.height <= ly + lh
            );
          })
          .map(f => f.id);
        
        setSelectedFieldIds(newlySelected);
      }
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
    setResizeState(null);
    setSnapLineY(null);
    setIsLasso(false);

    if (isDrawing) {
      setIsDrawing(false);
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);

      if (width > 0.5 && height > 0.5) {
        onAddField({
          id: generateId(),
          page: currentPage,
          x,
          y,
          width,
          height,
          variableName: `var_${fields.length + 1}`,
        });
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 z-10 ${mode === 'hand' ? 'cursor-grab active:cursor-grabbing' : mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Toolbar />

      {snapLineY !== null && (
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-indigo-500 z-0 pointer-events-none"
          style={{ top: `${snapLineY}%` }}
        />
      )}

      {isLasso && (
        <div
          className="absolute border border-indigo-500 bg-indigo-500/10 pointer-events-none z-40"
          style={{
            left: `${Math.min(startPos.x, currentPos.x)}%`,
            top: `${Math.min(startPos.y, currentPos.y)}%`,
            width: `${Math.abs(currentPos.x - startPos.x)}%`,
            height: `${Math.abs(currentPos.y - startPos.y)}%`,
          }}
        />
      )}

      {fields
        .filter((f) => f.page === currentPage)
        .map((field) => {
          const isSelected = selectedFieldIds.includes(field.id);
          return (
            <div
              key={field.id}
              className={`absolute border-2 flex flex-col items-start justify-start overflow-visible transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/30 z-20 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-rose-500 bg-rose-500/10 hover:bg-rose-500/20 z-10'
              } ${mode === 'select' ? 'cursor-move' : 'cursor-default'}`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
              }}
              onMouseDown={(e) => {
                if (mode !== 'select') return;
                e.stopPropagation();
                
                let nextSelection: string[];
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  if (isSelected) {
                    nextSelection = selectedFieldIds.filter(id => id !== field.id);
                  } else {
                    nextSelection = [...selectedFieldIds, field.id];
                  }
                } else {
                  if (!isSelected) {
                    nextSelection = [field.id];
                  } else {
                    nextSelection = selectedFieldIds;
                  }
                }
                setSelectedFieldIds(nextSelection);

                const fieldsToDrag = fields.filter(f => nextSelection.includes(f.id));
                setDragState({
                  startX: e.clientX,
                  startY: e.clientY,
                  mainFieldId: field.id,
                  initialPositions: fieldsToDrag.map(f => ({
                    id: f.id,
                    x: f.x,
                    y: f.y,
                    width: f.width,
                    height: f.height
                  }))
                });
              }}
            >
              <div className={`text-[10px] px-1 font-mono truncate w-full pointer-events-none select-none ${isSelected ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'}`}>
                {field.variableName}
              </div>

              {/* Resize Handles */}
              {isSelected && selectedFieldIds.length === 1 && mode === 'select' && (
                <>
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
                    <div
                      key={handle}
                      className={`absolute w-2.5 h-2.5 bg-white border-2 border-indigo-500 rounded-full z-50 hover:scale-125 transition-transform cursor-${handle}-resize`}
                      style={{
                        top: handle.includes('n') ? '-5px' : handle.includes('s') ? 'calc(100% - 5px)' : 'calc(50% - 5px)',
                        left: handle.includes('w') ? '-5px' : handle.includes('e') ? 'calc(100% - 5px)' : 'calc(50% - 5px)',
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizeState({
                          id: field.id,
                          handle,
                          startX: e.clientX,
                          startY: e.clientY,
                          initialX: field.x,
                          initialY: field.y,
                          initialWidth: field.width,
                          initialHeight: field.height,
                        });
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      {isDrawing && (
        <div
          className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none z-40"
          style={{
            left: `${Math.min(startPos.x, currentPos.x)}%`,
            top: `${Math.min(startPos.y, currentPos.y)}%`,
            width: `${Math.abs(currentPos.x - startPos.x)}%`,
            height: `${Math.abs(currentPos.y - startPos.y)}%`,
          }}
        />
      )}
    </div>
  );
};
