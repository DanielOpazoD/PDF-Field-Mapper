import React from 'react';
import { FileText, Upload, FileJson, ChevronLeft, ChevronRight, Trash2, Download, Square } from 'lucide-react';
import { usePdf } from '../contexts/PdfContext';

export const Sidebar: React.FC = () => {
  const {
    fields,
    selectedFieldIds,
    currentPage,
    numPages,
    pdfFile,
    setCurrentPage,
    handleFileUpload,
    handleJsonUpload,
    handleExport,
    handleDownloadPdf,
    setSelectedFieldIds,
    onUpdateFieldName,
    onDeleteFields,
    clearFields,
    syncY,
    syncX,
    fileInputRef,
    jsonInputRef,
  } = usePdf();

  return (
    <div className="w-80 bg-white border-r border-neutral-200 flex flex-col flex-shrink-0 shadow-sm z-20">
      <div className="p-6 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-none mb-1">PDF Mapper</h1>
            <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Field Coordinator Pro</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl transition-all font-semibold text-sm shadow-md shadow-indigo-100 active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            Cargar PDF
          </button>
          
          <input
            type="file"
            accept=".json"
            onChange={handleJsonUpload}
            className="hidden"
            ref={jsonInputRef}
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 py-3 px-4 rounded-xl transition-all font-semibold text-sm shadow-sm active:scale-[0.98]"
          >
            <FileJson className="w-4 h-4" />
            Importar JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-neutral-50/30">
        {numPages > 0 && (
          <section className="space-y-4">
            <h2 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest px-1">Navegación</h2>
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-neutral-200 shadow-sm">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 hover:bg-neutral-100 rounded-lg disabled:opacity-20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-neutral-900">{currentPage} <span className="text-neutral-400 font-medium">de</span> {numPages}</span>
                <span className="text-[10px] text-neutral-400 font-medium uppercase">Página</span>
              </div>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="p-2 hover:bg-neutral-100 rounded-lg disabled:opacity-20 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Campos Mapeados</h2>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-indigo-200">
              {fields.length}
            </span>
          </div>
          
          <div className="flex gap-2 mb-4">
            <button 
              onClick={syncY}
              className="flex-1 text-[10px] bg-white border border-neutral-200 py-1.5 rounded-lg font-bold text-neutral-600 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            >
              SINC Y
            </button>
            <button 
              onClick={syncX}
              className="flex-1 text-[10px] bg-white border border-neutral-200 py-1.5 rounded-lg font-bold text-neutral-600 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            >
              SINC X
            </button>
            <button 
              onClick={clearFields}
              className="px-2 text-[10px] bg-white border border-neutral-200 py-1.5 rounded-lg font-bold text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all shadow-sm active:scale-95"
              title="Limpiar todos los campos"
            >
              CLEAR
            </button>
          </div>

          <div className="space-y-2.5">
            {fields.map((field) => {
              const isSelected = selectedFieldIds.includes(field.id);
              return (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldIds([field.id])}
                  className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500/20'
                      : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <input
                      type="text"
                      className={`text-xs font-bold bg-transparent border-none p-0 focus:ring-0 w-full ${isSelected ? 'text-indigo-600' : 'text-neutral-700'}`}
                      value={field.variableName}
                      onChange={(e) => onUpdateFieldName(field.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFields([field.id]);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1.5 py-0.5 rounded-md">Pág {field.page}</span>
                    <span className="text-[9px] text-neutral-400 font-medium">X: {field.x.toFixed(1)}% | Y: {field.y.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
            {fields.length === 0 && (
              <div className="text-center py-10 px-4 border-2 border-dashed border-neutral-200 rounded-2xl">
                <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Square className="w-5 h-5 text-neutral-300" />
                </div>
                <p className="text-sm text-neutral-400 font-medium italic">No hay campos aún. Dibuja sobre el PDF para comenzar.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-neutral-200 bg-white space-y-3">
        <button
          onClick={handleDownloadPdf}
          disabled={!pdfFile}
          className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-indigo-600 py-3.5 px-4 rounded-xl transition-all font-bold text-sm shadow-sm disabled:opacity-50 active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          Descargar PDF
        </button>
        <button
          onClick={handleExport}
          disabled={fields.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-xl transition-all font-bold text-sm shadow-md shadow-indigo-100 disabled:opacity-50 active:scale-[0.98]"
        >
          <FileJson className="w-4 h-4" />
          Exportar JSON
        </button>
      </div>
    </div>
  );
};
