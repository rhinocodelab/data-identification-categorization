'use client';

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import AutoCategorizeUpload from '@/components/AutoCategorizeUpload';
import { FileImage, FileText, FileAudio, FileVideo, Tag, Layers, Target, BarChart2, Folder, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FolderTree from '@/components/FolderTree';
import AudioCategorizePlayer from '@/components/AudioCategorizePlayer';

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
  const [imgDims, setImgDims] = useState<{ renderedWidth: number; renderedHeight: number; naturalWidth: number; naturalHeight: number } | null>(null);
  const [hoveredBox, setHoveredBox] = useState<null | { type: 'ocr' | 'visual'; mouseX: number; mouseY: number }>(null);
  const [visualPreviewUrl, setVisualPreviewUrl] = useState<string | null>(null);

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
        } else {
          toast.success(`File auto-categorized to: ${result.category}`);
        }
      } else {
        toast.error(result.error || 'Auto-categorization failed');
      }
    } catch (err: any) {
      toast.error('Auto-categorization failed');
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

  // Handler to update image dimensions after load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    setImgDims({
      renderedWidth: img.width,
      renderedHeight: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
        <Breadcrumb items={[{ label: 'Auto Categorize' }]} />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Auto Categorize Data</h1>
          <button
            onClick={handleClearData}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
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
                  <p className="text-green-800 text-sm">Data uploaded successfully! You can now auto-categorize it.</p>
                </div>
              )}

              {autoCategorizeResult && (
                <div className={`mt-4 p-3 border rounded-md ${
                  autoCategorizeResult.category === 'un-identified data' 
                    ? 'bg-yellow-50 border-yellow-200' 
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
                      <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                      DOCX Files
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
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* API Response and Visualization Card */}
              <div className="xl:col-span-3 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">API Response &amp; Data Visualization</h2>
                {autoCategorizeResult ? (
                  <div className="space-y-6">
                    {/* API Response JSON */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">API Response</h3>
                      <pre className="bg-gray-100 rounded p-3 text-xs text-gray-800 overflow-x-auto border border-gray-200 max-h-40 overflow-y-auto">
                        {JSON.stringify(autoCategorizeResult, null, 2)}
                      </pre>
                    </div>

                    {/* PDF-specific display - show matching keywords and page numbers */}
                    {autoCategorizeResult.destPath && autoCategorizeResult.destPath.match(/\.pdf$/i) && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">PDF Analysis Results</h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Matched Keywords</h4>
                            {autoCategorizeResult.matchedKeywords && autoCategorizeResult.matchedKeywords.length > 0 ? (
                              <div className="space-y-2">
                                {autoCategorizeResult.matchedKeywords.map((match: any, index: number) => (
                                  <div key={index} className="bg-white rounded border border-blue-200 p-2">
                                    <div className="text-xs text-blue-800">
                                      <span className="font-medium">Keyword:</span> "{match.keyword}"
                                    </div>
                                    <div className="text-xs text-blue-700">
                                      <span className="font-medium">Page:</span> {match.pageNumber}
                                    </div>
                                    {match.context && (
                                      <div className="text-xs text-blue-600 mt-1">
                                        <span className="font-medium">Context:</span> "{match.context}"
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-blue-700">No keywords matched in the PDF content.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* JSON-specific display - show matching key-value pairs */}
                    {autoCategorizeResult.destPath && autoCategorizeResult.destPath.match(/\.json$/i) && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">JSON Analysis Results</h3>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-green-900 mb-2">Matched Key-Value Pairs</h4>
                            {autoCategorizeResult.matchedKeywords && autoCategorizeResult.matchedKeywords.length > 0 ? (
                              <div className="space-y-2">
                                {autoCategorizeResult.matchedKeywords.map((match: any, index: number) => (
                                  <div key={index} className="bg-white rounded border border-green-200 p-2">
                                    <div className="text-xs text-green-800">
                                      <span className="font-medium">Key-Value:</span> "{match.keyword}"
                                    </div>
                                    {match.context && (
                                      <div className="text-xs text-green-600 mt-1">
                                        <span className="font-medium">Found:</span> "{match.context}"
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-green-700">No key-value pairs matched in the JSON content.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Uploaded Image with Bounding Box and OCR Text */}
                    {autoCategorizeResult.destPath && autoCategorizeResult.destPath.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">Image Analysis Results</h3>
                        
                        {/* Visual Similarity Results */}
                        {autoCategorizeResult.allScores && autoCategorizeResult.allScores.length > 0 && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-medium text-purple-900 mb-2">Analysis Scores</h4>
                            <div className="space-y-2">
                              {autoCategorizeResult.allScores.map((score: any, index: number) => (
                                <div key={index} className="bg-white rounded border border-purple-200 p-3">
                                  <div className="text-xs text-purple-800 mb-2">
                                    <span className="font-medium">Annotation:</span> {score.dataId} ({score.ruleName})
                                  </div>
                                  <div className="text-xs text-purple-700 mb-1">
                                    <span className="font-medium">Total Score:</span> {score.totalScore?.toFixed(3) || '0.000'}
                                  </div>
                                  {score.scores && score.scores.length > 0 && (
                                    <div className="space-y-1">
                                      {score.scores.map((detail: any, detailIndex: number) => (
                                        <div key={detailIndex} className="text-xs text-purple-600 pl-2 border-l-2 border-purple-200">
                                          <span className="font-medium">
                                            {detail.type === 'ocr_text' ? 'OCR Text' : 
                                             detail.type === 'visual_annotation' ? 'Visual Annotation' : 
                                             'Visual Similarity'}:</span> {detail.similarity?.toFixed(3) || '0.000'}
                                          {detail.type === 'ocr_text' && detail.extracted && (
                                            <div className="text-purple-500 mt-1">
                                              <span className="font-medium">Extracted:</span> "{detail.extracted}"
                                            </div>
                                          )}
                                          {detail.type === 'ocr_text' && detail.stored && (
                                            <div className="text-purple-500">
                                              <span className="font-medium">Expected:</span> "{detail.stored}"
                                            </div>
                                          )}
                                          {detail.type === 'visual_annotation' && (
                                            <div className="text-purple-500 mt-1">
                                              <span className="font-medium">Visual Analysis:</span> Logo/Icon bounded region comparison
                                            </div>
                                          )}
                                          {detail.type === 'visual_similarity' && (
                                            <div className="text-purple-500 mt-1">
                                              <span className="font-medium">Visual Analysis:</span> Bounded region comparison (color, aspect ratio, size)
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Image Display */}
                        <div className="relative border border-gray-200 rounded shadow" style={{ overflow: 'auto', maxHeight: '70vh', maxWidth: '100%' }}>
                          <img
                            ref={imgRef}
                            src={`/${autoCategorizeResult.destPath.replace(/^public\//, '')}`}
                            alt="Uploaded"
                            className="block"
                            id="uploaded-image"
                            style={{ display: 'block' }}
                            onLoad={handleImageLoad}
                          />
                          {/* Draw bounding box if available */}
                          {autoCategorizeResult.matchedAnnotation && imgDims && (
                            <>
                              {(() => {
                                const scaleX = imgDims.renderedWidth / imgDims.naturalWidth;
                                const scaleY = imgDims.renderedHeight / imgDims.naturalHeight;
                                const boxes = [];
                                // OCR/text bounding box (green)
                                if (autoCategorizeResult.matchedAnnotation.bbox) {
                                  const b = autoCategorizeResult.matchedAnnotation.bbox;
                                  boxes.push(
                                    <div
                                      key="ocr-bbox"
                                      style={{
                                        position: 'absolute',
                                        left: b.x1 * scaleX,
                                        top: b.y1 * scaleY,
                                        width: (b.x2 - b.x1) * scaleX,
                                        height: (b.y2 - b.y1) * scaleY,
                                        border: '2px solid #34A853',
                                        background: 'rgba(52,168,83,0.1)',
                                        pointerEvents: 'auto',
                                        zIndex: 2,
                                      }}
                                      onMouseEnter={e => {
                                        setHoveredBox({ type: 'ocr', mouseX: e.clientX, mouseY: e.clientY });
                                      }}
                                      onMouseMove={e => {
                                        setHoveredBox({ type: 'ocr', mouseX: e.clientX, mouseY: e.clientY });
                                      }}
                                      onMouseLeave={() => setHoveredBox(null)}
                                    />
                                  );
                                }
                                // Visual annotation bounding box (purple)
                                if (autoCategorizeResult.matchedAnnotation.visualBbox) {
                                  const b = autoCategorizeResult.matchedAnnotation.visualBbox;
                                  boxes.push(
                                    <div
                                      key="visual-bbox"
                                      style={{
                                        position: 'absolute',
                                        left: b.x1 * scaleX,
                                        top: b.y1 * scaleY,
                                        width: (b.x2 - b.x1) * scaleX,
                                        height: (b.y2 - b.y1) * scaleY,
                                        border: '2px solid #a78bfa',
                                        background: 'rgba(167,139,250,0.12)',
                                        pointerEvents: 'auto',
                                        zIndex: 2,
                                      }}
                                      onMouseEnter={e => {
                                        // Generate preview
                                        const img = imgRef.current;
                                        if (img) {
                                          const url = createVisualPreview(img, autoCategorizeResult.matchedAnnotation.visualBbox);
                                          setVisualPreviewUrl(url);
                                        }
                                        setHoveredBox({ type: 'visual', mouseX: e.clientX, mouseY: e.clientY });
                                      }}
                                      onMouseMove={e => {
                                        setHoveredBox(prev => prev && prev.type === 'visual' ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : prev);
                                      }}
                                      onMouseLeave={() => {
                                        setHoveredBox(null);
                                        setVisualPreviewUrl(null);
                                      }}
                                    />
                                  );
                                }
                                return boxes;
                              })()}
                            </>
                          )}
                        </div>
                        
                        {/* OCR Texts */}
                        <div className="mt-2">
                          <div className="text-xs text-gray-700">
                            <b>Expected OCR Text:</b> {autoCategorizeResult.matchedAnnotation?.ocrText || <span className="italic text-gray-400">N/A</span>}
                          </div>
                          <div className="text-xs text-gray-700">
                            <b>Received OCR Text:</b> {autoCategorizeResult.extractedOcrText || <span className="italic text-gray-400">N/A</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No data uploaded yet. Upload a file to see the API response and visualization here.</div>
                )}
              </div>

              {/* Audio Player Card - Only show for successfully categorized audio files */}
              {autoCategorizeResult && autoCategorizeResult.success && autoCategorizeResult.destPath && 
               autoCategorizeResult.destPath.match(/\.(wav|mp3|flac|m4a|aac|ogg)$/i) && (
                <div className="xl:col-span-3">
                  {(() => {
                    // The destPath from API is like 'public/auto-categorized/audio/filename.wav'
                    // We need to remove 'public/' to make it accessible as '/auto-categorized/audio/filename.wav'
                    const audioUrl = `/${autoCategorizeResult.destPath.replace(/^public\//, '')}`;
                    console.log('Auto-categorize result:', autoCategorizeResult);
                    console.log('Original destPath:', autoCategorizeResult.destPath);
                    console.log('Constructed audioUrl:', audioUrl);
                    return (
                      <AudioCategorizePlayer
                        audioUrl={audioUrl}
                        transcript={autoCategorizeResult.transcript || []}
                        matchingSegments={autoCategorizeResult.matchingSegments || []}
                        fullTranscriptText={autoCategorizeResult.fullTranscriptText || ''}
                      />
                    );
                  })()}
                </div>
              )}

              {/* Category Structure Card */}
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
          {hoveredBox.type === 'ocr' && autoCategorizeResult.matchedAnnotation.ocrText && (
            <span style={{ fontSize: 14 }}>{autoCategorizeResult.matchedAnnotation.ocrText}</span>
          )}
          {hoveredBox.type === 'visual' && visualPreviewUrl && (
            <img src={visualPreviewUrl} alt="Visual Preview" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 4, border: '1px solid #a78bfa', background: '#fff' }} />
          )}
        </div>
      )}
    </div>
  );
} 