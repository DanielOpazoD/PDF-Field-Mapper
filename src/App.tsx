/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileMinus, FileText } from 'lucide-react';

import { usePdf } from './contexts/PdfContext';
import { PdfPageRenderer } from './components/PdfPageRenderer';
import { DrawingOverlay } from './components/DrawingOverlay';
import { Sidebar } from './components/Sidebar';
import { Notification } from './components/Notification';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';

export default function App() {
  const {
    pdfFile,
    pdfDocument,
    currentPage,
    numPages,
    fields,
    selectedFieldIds,
    isLoading,
    zoom,
    showDeleteConfirm,
    notification,
    setCurrentPage,
    setZoom,
    setSelectedFieldIds,
    setShowDeleteConfirm,
    handleFileUpload,
    handleJsonUpload,
    handleExport,
    handleDeletePage,
    handleDownloadPdf,
    onAddField,
    onUpdateFields,
    onUpdateFieldName,
    onDeleteFields,
    syncY,
    syncX,
    fileInputRef,
    jsonInputRef
  } = usePdf();

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 font-sans overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-neutral-100">
        <header className="bg-white border-b border-neutral-200 py-3 px-6 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Documento</span>
              <span className="text-sm font-bold text-neutral-700 truncate max-w-[300px]">
                {pdfFile ? pdfFile.name : 'Selecciona un PDF para comenzar'}
              </span>
            </div>
            
            {pdfDocument && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={numPages <= 1}
                className="flex items-center gap-2 text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all text-xs font-bold disabled:opacity-30"
              >
                <FileMinus className="w-4 h-4" />
                Eliminar Página
              </button>
            )}
          </div>
          <div className="text-xs font-mono text-neutral-400 bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-200">
            {isLoading ? 'PROCESANDO...' : pdfDocument ? 'LISTO' : 'ESPERANDO ARCHIVO'}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-12 flex justify-center items-start custom-scrollbar">
          {isLoading && !pdfDocument ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-neutral-500 font-bold animate-pulse uppercase tracking-widest text-xs">Cargando documento...</p>
            </div>
          ) : !pdfDocument ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md text-center">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-8 rotate-3 border border-neutral-100">
                <FileText className="w-10 h-10 text-indigo-200" />
              </div>
              <h2 className="text-2xl font-black text-neutral-900 mb-3 tracking-tight">Empieza a mapear</h2>
              <p className="text-neutral-500 leading-relaxed font-medium">Sube un archivo PDF para visualizarlo y empezar a definir las coordenadas de tus variables de manera precisa.</p>
            </div>
          ) : (
            <div className="relative inline-block bg-white shadow-2xl ring-1 ring-black/5 rounded-sm">
              <PdfPageRenderer pdfDocument={pdfDocument} pageNumber={currentPage} scale={zoom} />
              <DrawingOverlay />
            </div>
          )}
        </div>
      </main>

      <DeleteConfirmModal />

      <Notification />
    </div>
  );
}
