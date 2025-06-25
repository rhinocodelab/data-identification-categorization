'use client';

import { useState, useRef } from 'react';
import DataUpload from '@/components/ImageUpload';
import ImageMetadataTable, { ImageMetadataTableRef } from '@/components/ImageMetadataTable';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import toast from 'react-hot-toast';
import { FileImage, FileText, FileAudio, FileVideo, Tag, Layers, Target, BarChart2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const tableRef = useRef<ImageMetadataTableRef>(null);
  const router = useRouter();

  const handleDataUpload = () => {
    setUploadSuccess(true);
    toast.success('Data uploaded successfully! You can now annotate it from the table below.');
    
    // Refresh the table to show the new file
    if (tableRef.current) {
      tableRef.current.refresh();
    }
    
    // Reset success state after 3 seconds
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Data Files' }]} />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Data Upload */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Upload Data</h2>
              <DataUpload onDataUpload={() => handleDataUpload()} />
              
              {uploadSuccess && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">Data uploaded successfully! You can now annotate it from the table below.</p>
                </div>
              )}
            </div>

            {/* Key Features Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-600" />
                Key Features
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <Layers className="h-4 w-4 mr-2 text-green-600" />
                    Data Annotation & Categorization
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Comprehensive annotation tools for labeling and categorizing your data with precision and efficiency.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Supported File Types</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <FileImage className="h-4 w-4 mr-2 text-blue-500" />
                      Images
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-green-500" />
                      Text Files
                    </div>
                    <div className="flex items-center">
                      <FileAudio className="h-4 w-4 mr-2 text-purple-500" />
                      Audio Files
                    </div>
                    <div className="flex items-center">
                      <FileVideo className="h-4 w-4 mr-2 text-red-500" />
                      Video Files
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-orange-500" />
                      PDF Files
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                      DOCX Files
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center text-sm text-gray-600">
                    <Tag className="h-4 w-4 mr-2 text-blue-600" />
                    <span>Advanced labeling with custom categories and metadata</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Area - Metadata Table */}
          <div className="lg:col-span-3">
            <ImageMetadataTable ref={tableRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
