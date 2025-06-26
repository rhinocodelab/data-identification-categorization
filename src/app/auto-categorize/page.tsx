'use client';

import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import AutoCategorizeUpload from '@/components/AutoCategorizeUpload';
import { FileImage, FileText, FileAudio, FileVideo, Tag, Layers, Target, BarChart2, Folder, Clock, Trash2, Upload, Eye, EyeOff, Download, FileJson, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import FolderTree from '@/components/FolderTree';
import AudioCategorizePlayer from '@/components/AudioCategorizePlayer';

interface ImageDimensions {
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}

interface HoveredBox {
  type: 'ocr' | 'visual';
  mouseX: number;
  mouseY: number;
  text: string;
  category: string;
  confidence: number;
}

export default function AutoCategorizePage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [autoCategorizeResult, setAutoCategorizeResult] = useState<any>(null);
  const [categorizedFiles, setCategorizedFiles] = useState<Array<{
    fileName: string;
    category: string;
    timestamp: Date;
    score?: number;
    destPath: string;
  }>>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState<ImageDimensions | null>(null);
  const [hoveredBox, setHoveredBox] = useState<HoveredBox | null>(null);
  const [visualPreviewUrl, setVisualPreviewUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [croppedVisualImages, setCroppedVisualImages] = useState<{[key: string]: string}>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Helper function to highlight matched keywords in snippets
  const highlightKeywordInSnippet = (snippet: string, keyword: string) => {
    if (!snippet || !keyword) return snippet;
    
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return snippet.replace(regex, '<mark class="bg-yellow-200 font-semibold">$1</mark>');
  };

  // Component to render highlighted snippet
  const HighlightedSnippet = ({ snippet, keyword }: { snippet: string, keyword: string }) => {
    if (!snippet) {
      return <span className="italic text-gray-400">(No snippet found, showing keyword)</span>;
    }
    
    const highlightedText = highlightKeywordInSnippet(snippet, keyword);
    return (
      <span 
        dangerouslySetInnerHTML={{ __html: highlightedText }}
        className="inline-block"
      />
    );
  };

  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        setCategoriesError(null);
        const apiUrl = '/api/categories';
        console.log('Fetching categories from:', apiUrl);
        const res = await fetch(apiUrl);
        console.log('Response status:', res.status);
        console.log('Response headers:', res.headers);
        console.log('Response URL:', res.url);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const text = await res.text();
        console.log('Response text:', text.substring(0, 200));
        
        const data = JSON.parse(text);
        if (data.success) {
          setCategories(data.data);
          console.log('Categories loaded:', data.data.length);
        } else {
          throw new Error(data.error || 'Failed to load categories');
        }
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        setCategoriesError(error.message || 'Failed to load categories');
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleDataUpload = async (dataUrl: string) => {
    setUploadSuccess(true);
    setAutoCategorizeResult(null);
    setIsAnalyzing(true);
    toast.success('Data uploaded successfully! Auto-categorizing...');

    // Extract the relative file path for the API
    const filePath = dataUrl.startsWith('/') ? dataUrl.slice(1) : dataUrl;

    // Call the auto-categorize API
    try {
      const res = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const result = await res.json();
      setAutoCategorizeResult(result);
      
      if (result.success) {
        // Add to categorized files list
        const fileName = filePath.split('/').pop() || 'Unknown file';
        const newCategorizedFile = {
          fileName,
          category: result.category,
          timestamp: new Date(),
          score: result.score,
          destPath: result.destPath
        };
        setCategorizedFiles(prev => [newCategorizedFile, ...prev]);
        
        if (result.category === 'un-identified data') {
          toast.error('File could not be categorized - marked as un-identified data');
        } else if (result.category === 'uncategorized') {
          toast.error('File marked as uncategorized - no matching annotation patterns found');
        } else {
          toast.success(`File auto-categorized to: ${result.category}(score: ${result.score?.toFixed(2) || 'N/A'})`);
        }
      } else {
        toast.error(result.error || 'Auto-categorization failed');
      }
    } catch (err: any) {
      toast.error('Auto-categorization failed');
    } finally {
      setIsAnalyzing(false);
    }

    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all auto-categorized data? This will delete all files in temp, un-identified, and category folders.')) {
      return;
    }

    try {
      const res = await fetch('/api/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await res.json();
      
      if (result.success) {
        // Clear the categorized files state
        setCategorizedFiles([]);
        setAutoCategorizeResult(null);
        toast.success(result.message || 'Data cleared successfully');
      } else {
        toast.error(result.error || 'Failed to clear data');
      }
    } catch (error: any) {
      console.error('Error clearing data:', error);
      toast.error('Failed to clear data');
    }
  };

  const handleImageLoad = () => {
    if (imgRef.current) {
      const img = imgRef.current;
      setImgDims({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: img.offsetWidth,
        renderedHeight: img.offsetHeight,
      });
      
      // Create cropped images for visual matches
      if (autoCategorizeResult?.analysisResults?.visualMatches) {
        const croppedImages: {[key: string]: string} = {};
        autoCategorizeResult.analysisResults.visualMatches.forEach((match: any, index: number) => {
          if (match.boundingBox) {
            const croppedImage = createVisualPreview(img, match.boundingBox);
            if (croppedImage) {
              croppedImages[`visual-${index}`] = croppedImage;
            }
          }
        });
        setCroppedVisualImages(croppedImages);
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    // Implementation of handleFileUpload function
  };

  // Helper to create a cropped preview for visual annotation
  const createVisualPreview = (img: HTMLImageElement, bbox: any) => {
    const canvas = document.createElement('canvas');
    const width = bbox.x2 - bbox.x1;
    const height = bbox.y2 - bbox.y1;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, bbox.x1, bbox.y1, width, height, 0, 0, width, height);
      return canvas.toDataURL();
    }
    return null;
  };

  const analysis = autoCategorizeResult?.analysisResults;
  const isPDF = !!analysis?.pdfUrl || analysis?.type === 'pdf';
  const isImage = !!analysis?.detectedObjects || analysis?.imageUrl || analysis?.type === 'image';
  const isAudio = !!analysis?.transcription || analysis?.audioMetadata || analysis?.type === 'audio';
  const isJSON = !!analysis?.extractedKeys || analysis?.type === 'json';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
        <Breadcrumb items={[{ label: 'Auto Categorize' }]} />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Auto Categorize Data</h1>
          <button
            onClick={handleClearData}
            className="flex items-center gap-2 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors duration-200"
            title="Clear all auto-categorized data"
          >
            <Trash2 className="h-4 w-4" />
            Clear Data
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Data Upload */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Upload Data</h2>
              
              <AutoCategorizeUpload onDataUpload={handleDataUpload} />
              
              {uploadSuccess && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    <p className="text-green-800 text-sm">
                      {isAnalyzing ? 'Data uploaded successfully! Auto-categorizing...' : 'Data uploaded successfully! You can now auto-categorize it.'}
                    </p>
                  </div>
                </div>
              )}

              {autoCategorizeResult && (
                <div className={`mt-4 p-3 border rounded-md ${
                  autoCategorizeResult.category === 'un-identified data' 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : autoCategorizeResult.category === 'uncategorized'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  {autoCategorizeResult.success ? (
                    <div>
                      {autoCategorizeResult.category === 'un-identified data' ? (
                        <div>
                          <p className="text-yellow-800 text-sm font-medium mb-1">
                            ⚠️ Un-identified Data
                          </p>
                          <p className="text-yellow-700 text-xs">
                            The uploaded file could not be matched to any existing category. 
                            Score: {autoCategorizeResult.score?.toFixed(2) || 'N/A'} (threshold: {autoCategorizeResult.threshold || 0.3})
                          </p>
                        </div>
                      ) : autoCategorizeResult.category === 'uncategorized' ? (
                        <div>
                          <p className="text-orange-800 text-sm font-medium mb-1">
                            🔍 Uncategorized
                          </p>
                          <p className="text-orange-700 text-xs">
                            No matching annotation patterns found. File requires manual categorization.
                            Score: {autoCategorizeResult.score?.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-blue-800 text-sm font-medium mb-1">
                            ✅ Successfully Categorized
                          </p>
                          <p className="text-blue-700 text-sm">
                            File auto-categorized to: <b>{autoCategorizeResult.category}</b>
                            {autoCategorizeResult.score && (
                              <span className="text-xs text-blue-600 ml-2">
                                (score: {autoCategorizeResult.score.toFixed(2)})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-red-800 text-sm">
                      {autoCategorizeResult.error || 'Auto-categorization failed'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Key Features Card */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-600" />
                Auto Categorization
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <Layers className="h-4 w-4 mr-2 text-green-600" />
                    Intelligent File Sorting
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Automatically categorize uploaded files based on existing annotation rules and patterns.
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
                      <FileJson className="h-4 w-4 mr-2 text-indigo-500" />
                      JSON Files
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center text-sm text-gray-600">
                    <Tag className="h-4 w-4 mr-2 text-blue-600" />
                    <span>Smart categorization using annotation rules</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Area - API Response and Category Structure */}
          <div className="lg:col-span-3 xl:col-span-2">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2 text-blue-600" />
                API Response & Analysis
              </h2>
              
              {autoCategorizeResult ? (
                <div className="space-y-6">
                  {/* Basic Results */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Auto-Categorization Results</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Category:</span>
                        <span className="ml-2 text-gray-800">{autoCategorizeResult.category}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Confidence:</span>
                        <span className="ml-2 text-gray-800">{(autoCategorizeResult.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Text Matches:</span>
                        <span className="ml-2 text-gray-800">
                          {autoCategorizeResult.analysisResults?.matchingSegments
                            ? autoCategorizeResult.analysisResults.matchingSegments.length
                            : (autoCategorizeResult.analysisResults?.textMatches?.length || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Visual Matches:</span>
                        <span className="ml-2 text-gray-800">{autoCategorizeResult.analysisResults?.visualMatches?.length || 0}</span>
                      </div>
                      {isAudio && analysis?.audioMetadata && (
                        <>
                          <div>
                            <span className="font-medium text-gray-600">Duration:</span>
                            <span className="ml-2 text-gray-800">{analysis.audioMetadata.duration?.toFixed(1)}s</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Word Count:</span>
                            <span className="ml-2 text-gray-800">{analysis.audioMetadata.wordCount}</span>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="font-medium text-gray-600">File Type:</span>
                        <span className="ml-2 text-gray-800">
                          {isPDF ? 'PDF' : isImage ? 'Image' : isAudio ? 'Audio' : isJSON ? 'JSON' : 'Other'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Matched Text Snippets Section - Show for PDFs with matches */}
                  {isPDF && analysis?.matchingSegments?.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mt-4">
                      <h3 className="text-md font-semibold text-blue-800 mb-3 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Matched Text Snippets from PDF
                      </h3>
                      <div className="space-y-3">
                        {analysis.matchingSegments.map((match: any, idx: number) => {
                          // Try to extract a snippet from the extractedText or pages
                          let snippet = null;
                          if (match.pageNumber && analysis.pages) {
                            const page = analysis.pages.find((p: any) => p.pageNumber === match.pageNumber);
                            if (page && page.content) {
                              const idx = page.content.toLowerCase().indexOf(match.text.toLowerCase());
                              if (idx !== -1) {
                                // Show 40 chars before and after the match
                                const start = Math.max(0, idx - 40);
                                const end = Math.min(page.content.length, idx + match.text.length + 40);
                                snippet = page.content.substring(start, end);
                              }
                            }
                          }
                          // Fallback: try in extractedText
                          if (!snippet && analysis.extractedText) {
                            const idx = analysis.extractedText.toLowerCase().indexOf(match.text.toLowerCase());
                            if (idx !== -1) {
                              const start = Math.max(0, idx - 40);
                              const end = Math.min(analysis.extractedText.length, idx + match.text.length + 40);
                              snippet = analysis.extractedText.substring(start, end);
                            }
                          }
                          return (
                            <div key={idx} className="bg-white rounded p-3 border border-blue-100">
                              <div className="mb-1 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">Keyword:</span> <span className="ml-1">{match.text}</span>
                                {match.pageNumber && <span className="ml-2">| Page: {match.pageNumber}</span>}
                                <span className="ml-2">| Confidence: {(match.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="text-sm text-gray-800">
                                <span className="font-medium text-blue-700">Matched Snippet:</span>
                                <span className="ml-2 font-mono bg-blue-50 px-2 py-1 rounded">
                                  <HighlightedSnippet snippet={snippet} keyword={match.text} />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Audio Analysis Section - Show for Audio files with matches */}
                  {isAudio && analysis?.matchingSegments?.length > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 mt-4">
                      <h3 className="text-md font-semibold text-purple-800 mb-3 flex items-center">
                        <FileAudio className="h-4 w-4 mr-2" />
                        Audio Transcription & Matches
                      </h3>
                      
                      {/* Audio Metadata */}
                      {analysis.audioMetadata && (
                        <div className="mb-4 p-3 bg-white rounded border border-purple-100">
                          <h4 className="text-sm font-medium text-purple-700 mb-2">Audio Statistics</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>Duration: {analysis.audioMetadata.duration?.toFixed(1)}s</div>
                            <div>Word Count: {analysis.audioMetadata.wordCount}</div>
                            <div>Speech Rate: {analysis.audioMetadata.speechRate?.toFixed(1)} wpm</div>
                            <div>Unique Words: {analysis.audioMetadata.uniqueWords}</div>
                            <div>Vocabulary Diversity: {(analysis.audioMetadata.vocabularyDiversity * 100)?.toFixed(1)}%</div>
                            <div>Pause Count: {analysis.audioMetadata.pauseCount}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Legend for highlighting */}
                      <div className="mb-4 flex items-center space-x-4 text-xs">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-yellow-200 rounded"></div>
                          <span className="text-purple-700">Matched Keywords</span>
                        </div>
                      </div>
                      
                      {/* Matching Segments */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-purple-700">Matched Audio Segments ({analysis.matchingSegments.length})</h4>
                        {analysis.matchingSegments.map((match: any, idx: number) => (
                          <div key={idx} className="bg-white rounded p-3 border border-purple-100">
                            <div className="mb-1 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">Keyword:</span> <span className="ml-1">{match.text}</span>
                              {match.startTime !== undefined && match.endTime !== undefined && (
                                <span className="ml-2">| Time: {match.startTime.toFixed(1)}s - {match.endTime.toFixed(1)}s</span>
                              )}
                              <span className="ml-2">| Confidence: {(match.confidence * 100).toFixed(0)}%</span>
                              <span className="ml-2">| Source: {match.source}</span>
                              {match.gcpConfidence && (
                                <span className="ml-2">| GCP: {(match.gcpConfidence * 100).toFixed(0)}%</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-800">
                              <span className="font-medium text-purple-700">Matched Snippet:</span>
                              <span className="ml-2 font-mono bg-purple-50 px-2 py-1 rounded">
                                <HighlightedSnippet snippet={match.snippet} keyword={match.text} />
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Category: {match.category}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* JSON Analysis Section - Show for JSON files */}
                  {isJSON && (
                    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 mt-4">
                      <h3 className="text-md font-semibold text-indigo-800 mb-3 flex items-center">
                        <FileJson className="h-4 w-4 mr-2" />
                        JSON Key-Value Analysis
                      </h3>
                      
                      {/* Extracted Keys Summary */}
                      {analysis?.extractedKeys && (
                        <div className="mb-4 p-3 bg-white rounded border border-indigo-100">
                          <h4 className="text-sm font-medium text-indigo-700 mb-2">Extracted JSON Structure</h4>
                          <div className="text-xs text-gray-600 mb-2">
                            Total Keys: {analysis.extractedKeys.length}
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-xs">
                            {analysis.extractedKeys.slice(0, 5).map((keyValue: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span className="font-mono text-indigo-600">{keyValue.key}:</span>
                                <span className="text-gray-600 truncate ml-2">{keyValue.value}</span>
                              </div>
                            ))}
                            {analysis.extractedKeys.length > 5 && (
                              <div className="text-gray-500 italic">
                                ... and {analysis.extractedKeys.length - 5} more keys
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Matching Segments */}
                      {analysis?.matchingSegments && analysis.matchingSegments.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-indigo-700">Matched JSON Patterns ({analysis.matchingSegments.length})</h4>
                          {analysis.matchingSegments.map((match: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-3 border border-indigo-100">
                              <div className="mb-1 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">Pattern:</span> <span className="ml-1">{match.text}</span>
                                <span className="ml-2">| Confidence: {(match.confidence * 100).toFixed(0)}%</span>
                                <span className="ml-2">| Source: {match.source}</span>
                              </div>
                              {match.matchedKey && match.matchedValue && (
                                <div className="text-sm text-gray-800 mb-2">
                                  <span className="font-medium text-indigo-700">Matched:</span>
                                  <span className="ml-2 font-mono bg-indigo-50 px-2 py-1 rounded">
                                    "{match.matchedKey}": "{match.matchedValue}"
                                  </span>
                                </div>
                              )}
                              {match.snippet && (
                                <div className="text-sm text-gray-800">
                                  <span className="font-medium text-indigo-700">Snippet:</span>
                                  <span className="ml-2 font-mono bg-indigo-50 px-2 py-1 rounded text-xs">
                                    {match.snippet}
                                  </span>
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500">
                                Category: {match.category}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* No Matches Message */}
                      {(!analysis?.matchingSegments || analysis.matchingSegments.length === 0) && (
                        <div className="text-center py-4">
                          <div className="text-indigo-600 text-sm font-medium mb-1">No JSON Pattern Matches Found</div>
                          <div className="text-xs text-gray-500">
                            The JSON structure was successfully extracted, but no matching patterns were found in existing annotations.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image Analysis Card - Show when there are text or visual matches and it's an image */}
                  {((autoCategorizeResult.analysisResults?.textMatches?.length > 0 || 
                     autoCategorizeResult.analysisResults?.visualMatches?.length > 0) && 
                   autoCategorizeResult.analysisResults?.detectedObjects !== undefined) && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h3 className="text-lg font-medium text-blue-800 mb-4 flex items-center">
                        <FileImage className="h-5 w-5 mr-2" />
                        Image Analysis with Matching Annotations
                      </h3>
                      
                      {/* Hidden image for creating cropped previews */}
                      <img
                        src={autoCategorizeResult.analysisResults?.imageUrl || autoCategorizeResult.destPath}
                        alt="Hidden image for analysis"
                        style={{ display: 'none' }}
                        onLoad={handleImageLoad}
                        ref={imgRef}
                      />
                      
                      {/* Image dimensions info */}
                      {imgDims && (
                        <div className="mb-3 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                          Image Size: {autoCategorizeResult.analysisResults?.imageDimensions?.width || imgDims.naturalWidth} × {autoCategorizeResult.analysisResults?.imageDimensions?.height || imgDims.naturalHeight}px (Actual Size)
                        </div>
                      )}
                      
                      {/* Legend for bounding boxes */}
                      <div className="mb-4 flex items-center space-x-4 text-xs">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-blue-600 rounded"></div>
                          <span className="text-blue-700">OCR Text Match</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-purple-600 rounded"></div>
                          <span className="text-purple-700">Visual Element (Logo/Icon)</span>
                        </div>
                      </div>
                      
                      {/* Matching Annotations Details */}
                      <div className="space-y-4">
                        {isPDF && analysis?.matchingSegments?.length > 0 && (
                          <div>
                            <h4 className="text-md font-medium text-blue-700 mb-2 flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              PDF Keyword Matches ({analysis.matchingSegments.length})
                            </h4>
                            <div className="space-y-2">
                              {analysis.matchingSegments.map((match: any, index: number) => (
                                <div key={index} className="bg-white rounded p-3 border border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-gray-700">Matched Text:</span>
                                      <span className="ml-2 text-gray-600">"{match.text}"</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        PDF Keyword
                                      </span>
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        {(match.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Category: {match.category}
                                    {match.pageNumber && <> | Page: {match.pageNumber}</>}
                                    {match.matchType && <> | Type: {match.matchType}</>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {isImage && (
                          <>
                            {/* Text Matches Section */}
                            {analysis?.textMatches?.length > 0 && (
                              <div>
                                <h4 className="text-md font-medium text-blue-700 mb-2 flex items-center">
                                  <FileText className="h-4 w-4 mr-1" />
                                  Text Matches ({analysis.textMatches.length})
                                </h4>
                                <div className="space-y-2">
                                  {analysis.textMatches.map((match: any, index: number) => (
                                    <div key={index} className="bg-white rounded p-3 border border-blue-200">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-medium text-gray-700">OCR Text:</span>
                                          <span className="ml-2 text-gray-600">"{match.text}"</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            Text
                                          </span>
                                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                            {(match.confidence * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-xs text-gray-500">Category: {match.category}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Visual Matches Section */}
                            {analysis?.visualMatches?.length > 0 && (
                              <div>
                                <h4 className="text-md font-medium text-purple-700 mb-2 flex items-center">
                                  <FileImage className="h-4 w-4 mr-1" />
                                  Visual Element Matches ({analysis.visualMatches.length})
                                </h4>
                                <div className="space-y-2">
                                  {analysis.visualMatches.map((match: any, index: number) => (
                                    <div key={index} className="bg-white rounded p-3 border border-purple-200">
                                      <div className="flex items-start space-x-3">
                                        {/* Cropped Image Preview */}
                                        {croppedVisualImages[`visual-${index}`] && (
                                          <div className="flex-shrink-0">
                                            <img
                                              src={croppedVisualImages[`visual-${index}`]}
                                              alt={`Visual element ${index + 1}`}
                                              className="w-16 h-16 object-cover border border-purple-300 rounded"
                                              style={{
                                                minWidth: '64px',
                                                minHeight: '64px'
                                              }}
                                            />
                                          </div>
                                        )}
                                        {/* Text Information */}
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <span className="font-medium text-gray-700">Visual Element:</span>
                                              <span className="ml-2 text-gray-600">{match.text}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                                Visual
                                              </span>
                                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                {(match.confidence * 100).toFixed(0)}%
                                              </span>
                                            </div>
                                          </div>
                                          <div className="mt-1">
                                            <span className="text-xs text-gray-500">Category: {match.category}</span>
                                          </div>
                                          {match.boundingBox && (
                                            <div className="mt-1">
                                              <span className="text-xs text-gray-500">
                                                Position: ({Math.round(match.boundingBox.x1)}, {Math.round(match.boundingBox.y1)}) - 
                                                ({Math.round(match.boundingBox.x2)}, {Math.round(match.boundingBox.y2)})
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detailed Analysis Results */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <button
                      onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="text-lg font-medium text-gray-800">Detailed Analysis</h3>
                      {showDetailedAnalysis ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                    {showDetailedAnalysis && (
                      <div className="mt-3">
                        <pre className="text-xs text-gray-600 bg-white p-3 rounded border overflow-x-auto">
                          {JSON.stringify(autoCategorizeResult.analysisResults || autoCategorizeResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">No data uploaded yet. Upload a file to see the API response and visualization here.</div>
              )}
            </div>

            {/* Loading Spinner - Show while analyzing */}
            {isAnalyzing && (
              <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-center space-x-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <div className="text-gray-700 font-medium">Analyzing uploaded data...</div>
                </div>
                <div className="mt-3 text-center text-sm text-gray-500">
                  <p>Performing OCR, object detection, and pattern matching</p>
                  <p className="mt-1">This may take a few moments depending on file size and complexity</p>
                </div>
              </div>
            )}
          </div>

          {/* Category Structure Card - Always on the right side */}
          <div className="xl:col-span-1 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center">
              <Folder className="h-5 w-5 mr-2 text-green-600" />
              Category Structure
            </h2>
            
            {categorizedFiles.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No files categorized yet</p>
                <p className="text-xs">Upload files to see them appear here</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <FolderTree files={categorizedFiles} />
              </div>
            )}
            
            {categorizedFiles.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  Total files categorized: {categorizedFiles.length}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip rendering */}
      {hoveredBox && (
        <div
          style={{
            position: 'fixed',
            left: hoveredBox.mouseX + 12,
            top: hoveredBox.mouseY + 12,
            background: 'rgba(30,30,30,0.95)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 6,
            zIndex: 9999,
            pointerEvents: 'none',
            maxWidth: 300,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          {hoveredBox.type === 'ocr' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: '4px' }}>OCR Text Match</div>
              <div style={{ fontSize: 12, marginBottom: '2px' }}>"{hoveredBox.text}"</div>
              <div style={{ fontSize: 11, color: '#ccc' }}>Category: {hoveredBox.category}</div>
              <div style={{ fontSize: 11, color: '#ccc' }}>Confidence: {(hoveredBox.confidence * 100).toFixed(0)}%</div>
            </div>
          )}
          {hoveredBox.type === 'visual' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: '4px' }}>Visual Element Match</div>
              <div style={{ fontSize: 12, marginBottom: '2px' }}>Logo/Icon/Graphic Element</div>
              <div style={{ fontSize: 11, color: '#ccc' }}>Category: {hoveredBox.category}</div>
              <div style={{ fontSize: 11, color: '#ccc' }}>Confidence: {(hoveredBox.confidence * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 