'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string;
  onPageChange?: (pageNumber: number) => void;
  currentPage?: number;
}

export default function PDFViewer({ pdfUrl, onPageChange, currentPage = 1 }: PDFViewerProps) {
  const [loading, setLoading] = useState<boolean>(true);

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading PDF...</p>
          </div>
        </div>
      )}
      <div className="flex justify-center p-4">
        <div className="bg-white shadow-lg">
          <iframe
            src={`${pdfUrl}#page=${currentPage}`}
            className="border-0"
            width="800"
            height="600"
            onLoad={() => setLoading(false)}
            style={{ minHeight: '600px' }}
          />
        </div>
      </div>
    </div>
  );
} 