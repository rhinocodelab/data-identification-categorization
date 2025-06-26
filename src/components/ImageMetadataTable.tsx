'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, FileImage, FileText, FileAudio, Calendar, HardDrive, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageMetadata {
  filename: string;
  originalName: string;
  size: number;
  type: string;
  fileType?: 'image' | 'pdf' | 'json' | 'audio';
  uploadDate: string;
  url: string;
  hasAnnotations?: boolean;
  category?: {
    id: string;
    name: string;
    color?: string;
  };
}

export interface ImageMetadataTableRef {
  refresh: () => void;
  highlightNewUpload: (filename: string) => void;
}

export default forwardRef<ImageMetadataTableRef>((props, ref) => {
  const router = useRouter();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(7);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/images');
      if (!response.ok) {
        throw new Error('Failed to fetch data files');
      }
      const data = await response.json();
      
      // Load categories from MongoDB API
      let categories = [];
      try {
        const categoriesResponse = await fetch('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesResult = await categoriesResponse.json();
          if (categoriesResult.success) {
            categories = categoriesResult.data;
          }
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
      
      // Check for existing annotation data for each image
      const imagesWithAnnotationStatus = await Promise.all(
        data.map(async (image: ImageMetadata) => {
          try {
            const annotationResponse = await fetch(`/api/annotations/load/${image.filename}`);
            if (annotationResponse.ok) {
              const annotationData = await annotationResponse.json();
              const rule = annotationData.data?.rule;
              let category = undefined;
              
              if (rule?.categoryId) {
                const foundCategory = categories.find((cat: any) => cat.id === rule.categoryId);
                if (foundCategory) {
                  category = {
                    id: foundCategory.id,
                    name: foundCategory.name,
                    color: foundCategory.color
                  };
                }
              }
              
              return {
                ...image,
                hasAnnotations: true,
                category: category
              };
            } else if (annotationResponse.status === 404) {
              // 404 is expected for files without annotations - not an error
              return {
                ...image,
                hasAnnotations: false
              };
            } else {
              // Log other errors but don't fail the entire request
              console.warn(`Failed to load annotations for ${image.filename}: ${annotationResponse.status}`);
              return {
                ...image,
                hasAnnotations: false
              };
            }
          } catch (error) {
            // Log error but don't fail the entire request
            console.warn(`Error checking annotations for ${image.filename}:`, error);
            return {
              ...image,
              hasAnnotations: false
            };
          }
        })
      );
      
      setImages(imagesWithAnnotationStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(`Failed to load data files: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to highlight a newly uploaded file
  const highlightNewUpload = (filename: string) => {
    setHighlightedFiles(prev => new Set([...prev, filename]));
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      setHighlightedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }, 5000);
  };

  // Expose the refresh and highlight functions to parent component
  useImperativeHandle(ref, () => ({
    refresh: fetchImages,
    highlightNewUpload: highlightNewUpload
  }));

  const deleteImage = async (filename: string) => {
    try {
      setDeletingId(filename);
      const response = await fetch(`/api/images/${filename}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete data file');
      }
      
      const result = await response.json();
      
      // Remove the image from the local state
      setImages(prev => prev.filter(img => img.filename !== filename));
      
      // Show success message
      if (result.message) {
        toast.success(result.message);
      } else {
        toast.success(`Data file "${filename}" deleted successfully!`);
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete data file. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewImage = (filename: string) => {
    router.push(`/annotate/${filename}`);
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(images.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentImages = images.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Add a helper to format the file type
  const formatFileType = (ext: string, fileType?: 'image' | 'pdf' | 'json' | 'audio') => {
    if (fileType === 'pdf') {
      return 'PDF';
    }
    if (fileType === 'json') {
      return 'JSON';
    }
    if (fileType === 'audio') {
      return 'AUDIO';
    }
    
    const extNoDot = ext.replace(/^\./, '').toLowerCase();
    switch (extNoDot) {
      case 'jpg':
      case 'jpeg':
        return 'JPEG';
      case 'png':
        return 'PNG';
      case 'gif':
        return 'GIF';
      case 'bmp':
        return 'BMP';
      case 'webp':
        return 'WEBP';
      case 'tiff':
      case 'tif':
        return 'TIFF';
      case 'pdf':
        return 'PDF';
      case 'json':
        return 'JSON';
      case 'mp3':
        return 'MP3';
      case 'wav':
        return 'WAV';
      case 'ogg':
        return 'OGG';
      case 'm4a':
        return 'M4A';
      case 'aac':
        return 'AAC';
      default:
        return extNoDot.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading data files...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={fetchImages}
            className="mt-2 text-blue-600 hover:text-blue-700 underline transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center text-gray-900">
          <FileImage className="h-5 w-5 mr-2 text-blue-600" />
          Uploaded Data Files ({images.length})
        </h2>
        <button
          onClick={fetchImages}
          className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {images.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <FileImage className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No data files uploaded yet</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Upload Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Annotated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentImages.map((image) => (
                  <tr 
                    key={image.filename} 
                    className={`transition-all duration-500 ${
                      highlightedFiles.has(image.filename)
                        ? 'bg-green-50 border-l-4 border-l-green-500 shadow-sm'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      {image.fileType === 'pdf' ? (
                        <div className="h-12 w-12 bg-red-100 border border-red-200 rounded flex items-center justify-center">
                          <FileText className="h-6 w-6 text-red-600" />
                        </div>
                      ) : image.fileType === 'json' ? (
                        <div className="h-12 w-12 bg-green-100 border border-green-200 rounded flex items-center justify-center">
                          <FileText className="h-6 w-6 text-green-600" />
                        </div>
                      ) : image.fileType === 'audio' ? (
                        <div className="h-12 w-12 bg-purple-100 border border-purple-200 rounded flex items-center justify-center relative">
                          <FileAudio className="h-6 w-6 text-purple-600" />
                          {/* Audio waveform bars */}
                          <div className="absolute bottom-1 left-1 right-1 flex items-end justify-center space-x-0.5">
                            <div className="w-0.5 bg-purple-400 h-1"></div>
                            <div className="w-0.5 bg-purple-400 h-2"></div>
                            <div className="w-0.5 bg-purple-400 h-1.5"></div>
                            <div className="w-0.5 bg-purple-400 h-3"></div>
                            <div className="w-0.5 bg-purple-400 h-1"></div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={image.url}
                          alt={image.originalName}
                          className="h-12 w-12 object-cover rounded border border-gray-200"
                        />
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        <div 
                          className="truncate hover:text-blue-600 transition-colors cursor-help group relative" 
                          title={`Original: ${image.originalName}\nSystem: ${image.filename}`}
                        >
                          {image.originalName}
                          {image.originalName.length > 30 && (
                            <span className="text-gray-400 ml-1">...</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileType(image.type, image.fileType)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <HardDrive className="h-4 w-4 mr-1" />
                        {formatFileSize(image.size)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(image.uploadDate)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {image.category && (
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: image.category.color }}></div>
                          <span className="ml-2">{image.category.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${image.hasAnnotations ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewImage(image.filename)}
                          className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          title={image.hasAnnotations ? "View/Edit annotations" : "Annotate data"}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${image.originalName}"?`)) {
                              deleteImage(image.filename);
                            }
                          }}
                          disabled={deletingId === image.filename}
                          className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          title="Delete data file"
                        >
                          {deletingId === image.filename ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {images.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, images.length)} of {images.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-black"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => goToPage(pageNumber)}
                        className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                          currentPage === pageNumber
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-black"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}); 