'use client';

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface JSONViewerProps {
  jsonUrl: string;
}

export default function JSONViewer({ jsonUrl }: JSONViewerProps) {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJSONContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(jsonUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch JSON: ${response.statusText}`);
        }
        
        const text = await response.text();
        setJsonContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load JSON content');
        toast.error('Failed to load JSON content');
      } finally {
        setLoading(false);
      }
    };

    if (jsonUrl) {
      fetchJSONContent();
    }
  }, [jsonUrl]);

  const formatJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString; // Return original if not valid JSON
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-8 w-8 animate-pulse text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading JSON content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-center">
          <FileText className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">JSON Content</h3>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
          {formatJSON(jsonContent)}
        </pre>
      </div>
    </div>
  );
} 