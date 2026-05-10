import React from 'react';
import { Hand, MousePointer2, Square, ZoomOut, ZoomIn, Maximize, Trash2, Eraser } from 'lucide-react';
import { usePdf } from '../contexts/PdfContext';

export const Toolbar: React.FC = () => {
  const {
    mode,
    setMode,
    zoom,
    setZoom,
    selectedFieldIds,
    onDeleteFields,
    setSelectedFieldIds
  } = usePdf();

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 backdrop-blur border border-neutral-200 p-1.5 rounded-xl shadow-2xl z-[100] ring-1 ring-black/5">
      <button 
        onClick={() => setMode('hand')}
        className={`p-2 rounded-lg transition-all ${mode === 'hand' ? 'bg-indigo-600 text-white shadow-inner' : 'text-neutral-600 hover:bg-neutral-100'}`}
        title="Mano (Desplazar)"
      >
        <Hand className="w-5 h-5" />
      </button>
      <button 
        onClick={() => setMode('select')}
        className={`p-2 rounded-lg transition-all ${mode === 'select' ? 'bg-indigo-600 text-white shadow-inner' : 'text-neutral-600 hover:bg-neutral-100'}`}
        title="Selección (Lasso / Mover)"
      >
        <MousePointer2 className="w-5 h-5" />
      </button>
      <button 
        onClick={() => setMode('draw')}
        className={`p-2 rounded-lg transition-all ${mode === 'draw' ? 'bg-indigo-600 text-white shadow-inner' : 'text-neutral-600 hover:bg-neutral-100'}`}
        title="Dibujar Celda"
      >
        <Square className="w-5 h-5" />
      </button>
      <div className="w-px h-6 bg-neutral-200 mx-1" />
      
      {/* Zoom Controls */}
      <button 
        onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
        className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all"
        title="Alejar"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <span className="text-[10px] font-mono font-bold text-neutral-500 min-w-[3rem] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button 
        onClick={() => setZoom(Math.min(4, zoom + 0.25))}
        className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all"
        title="Acercar"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button 
        onClick={() => setZoom(1.5)}
        className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all"
        title="Restablecer Zoom"
      >
        <Maximize className="w-5 h-5" />
      </button>

      <div className="w-px h-6 bg-neutral-200 mx-1" />
      <button 
        onClick={() => {
          onDeleteFields(selectedFieldIds);
          setSelectedFieldIds([]);
        }}
        disabled={selectedFieldIds.length === 0}
        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition-all"
        title="Eliminar seleccionados"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      <button 
        onClick={() => setSelectedFieldIds([])}
        disabled={selectedFieldIds.length === 0}
        className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 transition-all"
        title="Deseleccionar todo"
      >
        <Eraser className="w-5 h-5" />
      </button>
    </div>
  );
};
