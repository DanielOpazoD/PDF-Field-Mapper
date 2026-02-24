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
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (id: string, updates: Partial<Field>) => void;
}

function DrawingOverlay({
  fields,
  currentPage,
  onAddField,
  selectedFieldId,
  onSelectField,
  onUpdateField,
}: DrawingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDrawing(true);
    onSelectField(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
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
      {fields
        .filter((f) => f.page === currentPage)
        .map((field) => {
          const isSelected = selectedFieldId === field.id;
          return (
            <div
              key={field.id}
              className={`absolute border-2 flex flex-col items-start justify-start overflow-hidden transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/20 z-20 shadow-md'
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
                onSelectField(field.id);
              }}
            >
              <div className={`text-[10px] px-1 font-mono truncate max-w-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'}`}>
                {field.variableName}
              </div>
            </div>
          );
        })}
      {isDrawing && (
        <div
          className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none"
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
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
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
      setSelectedFieldId(null);

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
        // Support importing both the exported format (with percentageCoordinates) 
        // and a simple raw format
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
          // Fallback if it's an older format or raw format
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
    
    // Reset input so the same file can be selected again
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const exportData = fields.map(field => {
      const dim = pageDimensions[field.page];
      
      // If dimensions aren't loaded for some reason, fallback to percentages
      if (!dim) return field;
      
      // Calculate absolute PDF points
      // PDF standard origin (0,0) is bottom-left. 
      // X goes left to right. Y goes bottom to top.
      const pdfX = (field.x / 100) * dim.width;
      const pdfW = (field.width / 100) * dim.width;
      const pdfH = (field.height / 100) * dim.height;
      // field.y is percentage from top. So bottom edge from top is field.y + field.height
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
    
    const exportFileDefaultName = 'pdf-fields.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
          
          <div>
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
              className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 py-2 px-4 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={!pdfDocument ? "Primero carga un PDF" : "Importar campos desde JSON"}
            >
              <FileJson className="w-4 h-4" />
              Importar JSON
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Campos ({fields.length})
          </h3>
          
          {fields.length === 0 ? (
            <div className="text-sm text-neutral-400 text-center py-8">
              No hay campos definidos.<br/>Dibuja sobre el PDF para agregar uno.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map(field => (
                <div
                  key={field.id}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    if (field.page !== currentPage) {
                      setCurrentPage(field.page);
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedFieldId === field.id
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
                        if (selectedFieldId === field.id) setSelectedFieldId(null);
                      }}
                      className="text-neutral-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {selectedFieldId === field.id ? (
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

                  {/* Show PDF Coordinates */}
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
              ))}
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
                  setSelectedFieldId(field.id);
                }}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onUpdateField={(id, updates) => {
                  setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
