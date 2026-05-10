/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Field, PageDimension, NotificationState, InteractionMode } from '../types';
import { generateId } from '../utils/pdfUtils';

interface PdfContextType {
  // State
  pdfFile: File | null;
  pdfBytes: Uint8Array | null;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  numPages: number;
  fields: Field[];
  selectedFieldIds: string[];
  isLoading: boolean;
  zoom: number;
  pageDimensions: Record<number, PageDimension>;
  showDeleteConfirm: boolean;
  notification: NotificationState | null;
  mode: InteractionMode;

  // Setters/Actions
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setMode: (mode: InteractionMode) => void;
  setSelectedFieldIds: (ids: string[]) => void;
  setShowDeleteConfirm: (show: boolean) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleJsonUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExport: () => void;
  handleDeletePage: () => Promise<void>;
  handleDownloadPdf: () => Promise<void>;
  onAddField: (field: Field) => void;
  onUpdateFields: (updates: Partial<Field>[]) => void;
  onUpdateFieldName: (id: string, name: string) => void;
  onDeleteFields: (ids: string[]) => void;
  syncY: () => void;
  syncX: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  jsonInputRef: React.RefObject<HTMLInputElement>;
}

const PdfContext = createContext<PdfContextType | undefined>(undefined);

export const PdfProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [pageDimensions, setPageDimensions] = useState<Record<number, PageDimension>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [mode, setMode] = useState<InteractionMode>('select');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedFields = localStorage.getItem('pdf-mapper-fields');
    if (savedFields) {
      try {
        setFields(JSON.parse(savedFields));
      } catch (e) {
        console.error('Error loading fields from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf-mapper-fields', JSON.stringify(fields));
  }, [fields]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setPdfFile(file);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer.slice(0));
      setPdfBytes(bytes);
      const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setFields([]);
      setSelectedFieldIds([]);
      const dims: Record<number, PageDimension> = {};
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        dims[i] = { width: viewport.width, height: viewport.height };
      }
      setPageDimensions(dims);
    } catch (error) {
      console.error(error);
      setNotification({ message: 'Error al cargar el PDF.', type: 'error' });
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
      if (!Array.isArray(jsonData)) throw new Error('Inválido');
      const importedFields: Field[] = jsonData.map((item: any) => ({
        id: item.id || generateId(),
        page: item.page || 1,
        variableName: item.variableName || `var_${generateId().substring(0,4)}`,
        x: item.percentageCoordinates?.x ?? item.x ?? 0,
        y: item.percentageCoordinates?.y ?? item.y ?? 0,
        width: item.percentageCoordinates?.width ?? item.width ?? 10,
        height: item.percentageCoordinates?.height ?? item.height ?? 5,
      }));
      setFields(importedFields);
      setNotification({ message: `Importados ${importedFields.length} campos.`, type: 'success' });
    } catch (error) {
      setNotification({ message: 'Error al importar JSON.', type: 'error' });
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
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
        pdfCoordinates: { x: Number(pdfX.toFixed(2)), y: Number(pdfY.toFixed(2)), width: Number(pdfW.toFixed(2)), height: Number(pdfH.toFixed(2)) },
        percentageCoordinates: { x: Number(field.x.toFixed(2)), y: Number(field.y.toFixed(2)), width: Number(field.width.toFixed(2)), height: Number(field.height.toFixed(2)) }
      };
    });
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = 'pdf-fields.json';
    link.click();
  };

  const handleDeletePage = async () => {
    if (!pdfBytes || numPages <= 1) return;
    setIsLoading(true);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0));
      pdfDoc.removePage(currentPage - 1);
      const newBytes = await pdfDoc.save();
      setPdfBytes(newBytes);
      const loadingTask = pdfjsLib.getDocument({ data: newBytes.slice(0) });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setFields(prev => prev.filter(f => f.page !== currentPage).map(f => f.page > currentPage ? { ...f, page: f.page - 1 } : f));
      const dims: Record<number, PageDimension> = {};
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        dims[i] = { width: viewport.width, height: viewport.height };
      }
      setPageDimensions(dims);
      const oldNumPages = numPages;
      setNumPages(pdf.numPages);
      if (currentPage >= oldNumPages) setCurrentPage(Math.max(1, pdf.numPages));
      setNotification({ message: 'Página eliminada.', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Error al eliminar página.', type: 'error' });
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdfFile ? `modificado_${pdfFile.name}` : 'modificado.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onAddField = (field: Field) => {
    setFields(prev => [...prev, field]);
    setSelectedFieldIds([field.id]);
  };

  const onUpdateFields = (updates: Partial<Field>[]) => {
    setFields(prev => prev.map(f => {
      const u = updates.find(update => (update as any).id === f.id);
      return u ? { ...f, ...u } : f;
    }));
  };

  const onUpdateFieldName = (id: string, name: string) => {
    // Basic validation: limit characters to safe variable names (alphanumeric and underscore)
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
    setFields(prev => prev.map(f => f.id === id ? { ...f, variableName: sanitized } : f));
  };

  const onDeleteFields = (ids: string[]) => {
    setFields(prev => prev.filter(f => !ids.includes(f.id)));
  };

  const syncY = () => {
    if (selectedFieldIds.length < 2) return;
    const ref = fields.find(f => f.id === selectedFieldIds[0]);
    if (!ref || !pageDimensions[ref.page]) return;
    const refDim = pageDimensions[ref.page];
    const refTopY = refDim.height - (ref.y / 100) * refDim.height;
    const refH = (ref.height / 100) * refDim.height;
    setFields(prev => prev.map(f => {
      if (!selectedFieldIds.includes(f.id)) return f;
      const tDim = pageDimensions[f.page];
      if (!tDim) return f;
      return { ...f, y: ((tDim.height - refTopY) / tDim.height) * 100, height: (refH / tDim.height) * 100 };
    }));
  };

  const syncX = () => {
    if (selectedFieldIds.length < 2) return;
    const ref = fields.find(f => f.id === selectedFieldIds[0]);
    if (!ref || !pageDimensions[ref.page]) return;
    const refDim = pageDimensions[ref.page];
    const refL = (ref.x / 100) * refDim.width;
    const refW = (ref.width / 100) * refDim.width;
    setFields(prev => prev.map(f => {
      if (!selectedFieldIds.includes(f.id)) return f;
      const tDim = pageDimensions[f.page];
      if (!tDim) return f;
      return { ...f, x: (refL / tDim.width) * 100, width: (refW / tDim.width) * 100 };
    }));
  };

  const clearFields = () => {
    setFields([]);
    setSelectedFieldIds([]);
    setNotification({ message: 'Todos los campos han sido eliminados.', type: 'info' });
  };

  const value = {
    pdfFile, pdfBytes, pdfDocument, currentPage, numPages, fields, selectedFieldIds, isLoading, zoom, pageDimensions, showDeleteConfirm, notification, mode,
    setCurrentPage, setZoom, setMode, setSelectedFieldIds, setShowDeleteConfirm, handleFileUpload, handleJsonUpload, handleExport, handleDeletePage, handleDownloadPdf,
    onAddField, onUpdateFields, onUpdateFieldName, onDeleteFields, clearFields, syncY, syncX, fileInputRef, jsonInputRef
  };

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
};

export const usePdf = () => {
  const context = useContext(PdfContext);
  if (!context) throw new Error('usePdf must be used within PdfProvider');
  return context;
};
