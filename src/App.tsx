/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Upload, Download, Trash2, ChevronLeft, ChevronRight, FileText, Settings2, FileJson } from 'lucide-react';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

interface Field {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  variableName: string;
}

interface PdfPageRendererProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
}

function PdfPageRenderer({ pdfDocument, pageNumber }: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isMounted = true;

    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (error) {
        if (error instanceof pdfjsLib.RenderingCancelledException) {
          // Ignore cancelled rendering
        } else {
          console.error('Error rendering page:', error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocument, pageNumber]);

  return <canvas ref={canvasRef} className="block w-full h-auto" />;
}

interface DrawingOverlayProps {
  fields: Field[];
  currentPage: number;
  onAddField: (field: Field) => void;
  selectedFieldIds: string[];
  onSelectFields: (ids: string[]) => void;
  onUpdateFields: (updates: { id: string; x?: number; y?: number }[]) => void;
}

function DrawingOverlay({
  fields,
  currentPage,
  onAddField,
  selectedFieldIds,
  onSelectFields,
  onUpdateFields,
}: DrawingOverlayProps) {
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
  const [snapLineY, setSnapLineY] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    
    // If Shift is held, it's always Lasso. Otherwise, if no field is under, it's Drawing or Lasso.
    // Let's make it: Click + Drag on empty space = Lasso. 
    // We'll decide between Drawing and Lasso based on a toggle or just use Lasso as default for empty space drag.
    // Actually, the user wants to "select multiple", so Lasso is better for empty space.
    setIsLasso(true);
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onSelectFields([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

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

      onUpdateFields(updates);
      return;
    }

    if (isLasso || isDrawing) {
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setCurrentPos({ x, y });

      if (isLasso) {
        // Update selection in real-time for Lasso
        const lx = Math.min(startPos.x, x);
        const ly = Math.min(startPos.y, y);
        const lw = Math.abs(x - startPos.x);
        const lh = Math.abs(y - startPos.y);

        const newlySelected = fields
          .filter(f => f.page === currentPage)
          .filter(f => {
            // Check if field is inside lasso rect
            return (
              f.x >= lx &&
              f.y >= ly &&
              f.x + f.width <= lx + lw &&
              f.y + f.height <= ly + lh
            );
          })
          .map(f => f.id);
        
        // If shift is held, we should probably add to existing selection, but for simplicity let's just set it
        onSelectFields(newlySelected);
      }
    }
  };

  const handleMouseUp = () => {
    if (dragState) {
      setDragState(null);
      setSnapLineY(null);
      return;
    }

    if (isLasso) {
      setIsLasso(false);
      // If the lasso was tiny, treat it as a click to clear selection (already handled in mousedown)
      // But if it was tiny and we want to DRAW, we could switch to drawing mode.
      // For now, let's just stick to Lasso for empty space.
      return;
    }

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
      className="absolute inset-0 cursor-crosshair z-10"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-2 right-2 flex gap-2 z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsDrawing(!isDrawing); setIsLasso(false); }}
          className={`p-2 rounded-lg shadow-md transition-colors ${isDrawing ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
          title="Modo Dibujo (Crear nuevos campos)"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

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
              className={`absolute border-2 flex flex-col items-start justify-start overflow-hidden transition-colors cursor-move ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/30 z-20 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-rose-500 bg-rose-500/10 hover:bg-rose-500/20 z-10'
              }`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
              }}
              onMouseDown={(e) => {
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
                onSelectFields(nextSelection);

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
              <div className={`text-[10px] px-1 font-mono truncate w-full pointer-events-none ${isSelected ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'}`}>
                {field.variableName}
              </div>
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
}

export default function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<Record<number, {width: number, height: number}>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    setPdfFile(file);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setFields([]);
      setSelectedFieldIds([]);

      // Fetch dimensions for all pages at scale 1.0 (standard PDF points)
      const dims: Record<number, {width: number, height: number}> = {};
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        dims[i] = { width: viewport.width, height: viewport.height };
      }
      setPageDimensions(dims);

    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error al cargar el PDF. Por favor, intenta con otro archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      if (!Array.isArray(jsonData)) {
        throw new Error('El archivo JSON debe contener un arreglo de campos.');
      }

      const importedFields: Field[] = jsonData.map((item: any) => {
        if (item.percentageCoordinates) {
          return {
            id: item.id || generateId(),
            page: item.page,
            variableName: item.variableName,
            x: item.percentageCoordinates.x,
            y: item.percentageCoordinates.y,
            width: item.percentageCoordinates.width,
            height: item.percentageCoordinates.height,
          };
        } else {
          return {
            id: item.id || generateId(),
            page: item.page || 1,
            variableName: item.variableName || `var_${generateId().substring(0,4)}`,
            x: item.x || 0,
            y: item.y || 0,
            width: item.width || 10,
            height: item.height || 5,
          };
        }
      });

      setFields(importedFields);
      alert(`Se importaron ${importedFields.length} campos exitosamente.`);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      alert('Error al leer el archivo JSON. Asegúrate de que sea un archivo válido exportado por esta herramienta.');
    }
    
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const exportData = fields.map(field => {
      const dim = pageDimensions[field.page];
      if (!dim) return field;
      
      const pdfX = (field.x / 100) * dim.width;
      const pdfW = (field.width / 100) * dim.width;
      const pdfH = (field.height / 100) * dim.height;
      const pdfY = dim.height - ((field.y + field.height) / 100) * dim.height;

      return {
        id: field.id,
        variableName: field.variableName,
        page: field.page,
        pdfCoordinates: {
          x: Number(pdfX.toFixed(2)),
          y: Number(pdfY.toFixed(2)),
          width: Number(pdfW.toFixed(2)),
          height: Number(pdfH.toFixed(2))
        },
        percentageCoordinates: {
          x: Number(field.x.toFixed(2)),
          y: Number(field.y.toFixed(2)),
          width: Number(field.width.toFixed(2)),
          height: Number(field.height.toFixed(2))
        }
      };
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'pdf-fields.json');
    linkElement.click();
  };

  const syncY = () => {
    if (selectedFieldIds.length < 2) return;
    
    const selectedFields = fields.filter(f => selectedFieldIds.includes(f.id));
    // Use the Y of the first selected field as the target
    const targetY = selectedFields[0].y;
    
    setFields(fields.map(f => {
      if (selectedFieldIds.includes(f.id)) {
        return { ...f, y: targetY };
      }
      return f;
    }));
  };

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-neutral-200 flex flex-col shadow-sm z-20">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2 font-semibold text-neutral-800">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            <span>Mapeador PDF</span>
          </div>
        </div>

        <div className="p-4 border-b border-neutral-200 space-y-3">
          <div>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors font-medium text-sm"
            >
              <Upload className="w-4 h-4" />
              Cargar PDF
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              ref={jsonInputRef}
              onChange={handleJsonUpload}
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              disabled={!pdfDocument}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 py-2 px-2 rounded-lg transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title={!pdfDocument ? "Primero carga un PDF" : "Importar campos desde JSON"}
            >
              <FileJson className="w-4 h-4" />
              Importar
            </button>

            <button
              onClick={syncY}
              disabled={selectedFieldIds.length < 2}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 py-2 px-2 rounded-lg transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sincronizar altura (Y) de seleccionados"
            >
              <Settings2 className="w-4 h-4" />
              Sinc. Y
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Campos ({fields.length})
            </h3>
            {selectedFieldIds.length > 0 && (
              <button 
                onClick={() => {
                  setFields(fields.filter(f => !selectedFieldIds.includes(f.id)));
                  setSelectedFieldIds([]);
                }}
                className="text-[10px] text-rose-500 hover:underline font-medium"
              >
                Eliminar seleccionados
              </button>
            )}
          </div>
          
          {fields.length === 0 ? (
            <div className="text-sm text-neutral-400 text-center py-8">
              No hay campos definidos.<br/>Dibuja sobre el PDF para agregar uno.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map(field => {
                const isSelected = selectedFieldIds.includes(field.id);
                return (
                  <div
                    key={field.id}
                    onClick={(e) => {
                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        if (isSelected) {
                          setSelectedFieldIds(selectedFieldIds.filter(id => id !== field.id));
                        } else {
                          setSelectedFieldIds([...selectedFieldIds, field.id]);
                        }
                      } else {
                        setSelectedFieldIds([field.id]);
                      }
                      
                      if (field.page !== currentPage) {
                        setCurrentPage(field.page);
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        Pág {field.page}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFields(fields.filter(f => f.id !== field.id));
                          setSelectedFieldIds(selectedFieldIds.filter(id => id !== field.id));
                        }}
                        className="text-neutral-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {isSelected && selectedFieldIds.length === 1 ? (
                      <input
                        type="text"
                        value={field.variableName}
                        onChange={(e) => {
                          setFields(fields.map(f => 
                            f.id === field.id ? { ...f, variableName: e.target.value } : f
                          ));
                        }}
                        className="w-full text-sm font-mono border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="text-sm font-mono text-neutral-700 truncate">
                        {field.variableName}
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-neutral-400 font-mono grid grid-cols-2 gap-1">
                      {pageDimensions[field.page] ? (() => {
                        const dim = pageDimensions[field.page];
                        const pdfX = (field.x / 100) * dim.width;
                        const pdfY = dim.height - ((field.y + field.height) / 100) * dim.height;
                        const pdfW = (field.width / 100) * dim.width;
                        const pdfH = (field.height / 100) * dim.height;
                        return (
                          <>
                            <div>x: {pdfX.toFixed(1)}</div>
                            <div>y: {pdfY.toFixed(1)}</div>
                            <div>w: {pdfW.toFixed(1)}</div>
                            <div>h: {pdfH.toFixed(1)}</div>
                          </>
                        );
                      })() : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={handleExport}
            disabled={fields.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 py-2 px-4 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-neutral-100/50">
        {/* Toolbar */}
        <div className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            {pdfDocument && (
              <div className="flex items-center gap-2 bg-neutral-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-neutral-600 min-w-[4rem] text-center">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="text-sm text-neutral-500">
            {pdfFile ? pdfFile.name : 'Ningún archivo seleccionado'}
          </div>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Cargando PDF...</p>
            </div>
          ) : !pdfDocument ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 max-w-md text-center">
              <FileText className="w-16 h-16 mb-4 text-neutral-300" />
              <h2 className="text-lg font-medium text-neutral-600 mb-2">Comienza subiendo un PDF</h2>
              <p className="text-sm">
                Sube un documento PDF para comenzar a dibujar las cajas de variables. 
                Haz clic y arrastra sobre el documento para definir las áreas.
              </p>
            </div>
          ) : (
            <div className="relative inline-block bg-white shadow-xl ring-1 ring-neutral-200">
              <PdfPageRenderer pdfDocument={pdfDocument} pageNumber={currentPage} />
              <DrawingOverlay
                fields={fields}
                currentPage={currentPage}
                onAddField={(field) => {
                  setFields([...fields, field]);
                  setSelectedFieldIds([field.id]);
                }}
                selectedFieldIds={selectedFieldIds}
                onSelectFields={setSelectedFieldIds}
                onUpdateFields={(updates) => {
                  setFields(fields.map(f => {
                    const update = updates.find(u => u.id === f.id);
                    return update ? { ...f, ...update } : f;
                  }));
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
