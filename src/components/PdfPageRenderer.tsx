import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface PdfPageRendererProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({ pdfDocument, pageNumber, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isMounted = true;

    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (error) {
        if (!(error instanceof pdfjsLib.RenderingCancelledException)) {
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
  }, [pdfDocument, pageNumber, scale]);

  return <canvas ref={canvasRef} className="block w-full h-auto" />;
};
