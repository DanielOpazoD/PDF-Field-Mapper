import React from 'react';
import { usePdf } from '../contexts/PdfContext';

export const Notification: React.FC = () => {
  const { notification } = usePdf();
  
  if (!notification) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[300] p-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex items-center gap-3 border ${
      notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
    }`}>
      <div className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      <p className="font-medium">{notification.message}</p>
    </div>
  );
};
