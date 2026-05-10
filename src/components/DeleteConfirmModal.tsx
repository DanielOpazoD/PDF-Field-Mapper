import React from 'react';
import { Trash2 } from 'lucide-react';
import { usePdf } from '../contexts/PdfContext';

export const DeleteConfirmModal: React.FC = () => {
  const { showDeleteConfirm, currentPage, setShowDeleteConfirm, handleDeletePage } = usePdf();
  
  if (!showDeleteConfirm) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="p-2 bg-rose-50 rounded-full">
            <Trash2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold">¿Eliminar página {currentPage}?</h3>
        </div>
        <p className="text-neutral-600 mb-6 leading-relaxed">
          Esta acción eliminará permanentemente la página <strong>{currentPage}</strong> del documento y todos los campos que hayas mapeado en ella. No se puede deshacer.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDeletePage}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shadow-sm transition-all"
          >
            Sí, eliminar página
          </button>
        </div>
      </div>
    </div>
  );
};
