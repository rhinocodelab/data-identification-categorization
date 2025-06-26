'use client';

import { useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DataUploadProps {
  onDataUpload: (dataUrl: string, filename: string) => void;
}

interface UploadStatus {
  loading: boolean;
  success: boolean;
  error: string | null;
}

export default function DataUpload({ onDataUpload }: DataUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    loading: false,
    success: false,
    error: null
  });

  const uploadFile = useCallback(async (file: File) => {
    setUploadStatus({ loading: true, success: false, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus({ loading: false, success: true, error: null });
      
      // Use the server URL for the file
      onDataUpload(result.url, result.filename);
      
      // Show success toast
      toast.success(`File "${file.name}" uploaded successfully!`);
      
      // Reset success status after 2 seconds
      setTimeout(() => {
        setUploadStatus({ loading: false, success: false, error: null });
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
      toast.error(`Upload failed: ${errorMessage}`);
    }
  }, [onDataUpload]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'application/json' || file.name.toLowerCase().endsWith('.json') || file.type.startsWith('audio/'))) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const getStatusContent = () => {
    if (uploadStatus.loading) {
      return (
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-blue-600">Uploading...</span>
        </div>
      );
    }

    if (uploadStatus.success) {
      return (
        <div className="flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
          <span className="text-green-600">Upload successful!</span>
        </div>
      );
    }

    if (uploadStatus.error) {
      return (
        <div className="flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
          <span className="text-red-600">{uploadStatus.error}</span>
        </div>
      );
    }

    return (
      <>
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
            Click to upload
          </span>{' '}
          or drag and drop
        </p>
      </>
    );
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        uploadStatus.loading
          ? 'border-blue-500 bg-blue-50'
          : uploadStatus.success
          ? 'border-green-500 bg-green-50'
          : uploadStatus.error
          ? 'border-red-500 bg-red-50'
          : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        type="file"
        accept="image/*,.pdf,.json,audio/*"
        onChange={handleFileChange}
        className="hidden"
        id="data-upload"
        disabled={uploadStatus.loading}
      />
      <label 
        htmlFor="data-upload" 
        className={`cursor-pointer ${uploadStatus.loading ? 'pointer-events-none' : ''}`}
      >
        {getStatusContent()}
      </label>
    </div>
  );
} 