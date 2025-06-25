'use client';

import { Trash2, Eye, Plus, FileText, Loader2 } from 'lucide-react';
import { Rule, Annotation } from '@/types/annotation';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AnnotationListProps {
  rule: Rule | null;
  annotations: Annotation[];
  dataURL: string;
  fileType: 'image' | 'pdf' | 'json' | 'audio';
  onDeleteAnnotation: (id: string) => void;
  onSelectAnnotation: (annotation: Annotation) => void;
  onUpdateRule: (rule: Rule) => void;
  onCreateRule: (ruleName: string) => void;
  onUpdateAnnotation: (annotation: Annotation) => void;
}

// Helper component to render a cropped preview for visual annotations
function CroppedImagePreview({ src, x1, y1, x2, y2 }: { src: string, x1: number, y1: number, x2: number, y2: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const width = x2 - x1;
      const height = y2 - y1;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height);
          setDataUrl(canvas.toDataURL());
        }
      }
    };
  }, [src, x1, y1, x2, y2]);

  return dataUrl ? (
    <img
      src={dataUrl}
      alt="Visual Element Preview"
      style={{ width: 64, height: 64, borderRadius: 6, border: '1px solid #a78bfa', background: '#fff', objectFit: 'contain' }}
    />
  ) : (
    <canvas ref={canvasRef} style={{ display: 'none' }} />
  );
}

export default function AnnotationList({
  rule, 
  annotations,
  dataURL, 
  fileType, 
  onDeleteAnnotation, 
  onSelectAnnotation, 
  onUpdateRule,
  onCreateRule,
  onUpdateAnnotation
}: AnnotationListProps) {
  const [newRuleName, setNewRuleName] = useState('');
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [editingRuleName, setEditingRuleName] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);

  const handleCreateRule = () => {
    if (newRuleName.trim()) {
      onCreateRule(newRuleName.trim());
      setNewRuleName('');
      setShowAddRuleForm(false);
    }
  };

  const handleUpdateRuleName = () => {
    if (rule && editingRuleName.trim()) {
      onUpdateRule({ ...rule, ruleName: editingRuleName.trim() });
      setEditingRuleName('');
    }
  };

  const handleOCR = async (annotation: Annotation) => {
    try {
      setOcrLoading(annotation.id);
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imagePath: dataURL,
          boundingBox: {
            x1: Math.round(annotation.x1),
            y1: Math.round(annotation.y1),
            x2: Math.round(annotation.x2),
            y2: Math.round(annotation.y2),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'OCR failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const updatedAnnotation = {
          ...annotation,
          ocrText: result.text,
          ocrConfidence: result.confidence,
        };
        onUpdateAnnotation(updatedAnnotation);
        
        if (result.text) {
          toast.success(`OCR completed: "${result.text}"`);
        } else {
          toast.success('No text detected in this region');
        }
      } else {
        throw new Error(result.error || 'OCR failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OCR failed';
      toast.error(`OCR Error: ${errorMessage}`);
    } finally {
      setOcrLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Rule Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-72 overflow-y-auto">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Annotation Rule</h3>
        
        {!rule ? (
          <div>
            <p className="text-sm text-blue-700 mb-3">No rule defined for this data file.</p>
            {!showAddRuleForm ? (
              <button
                onClick={() => setShowAddRuleForm(true)}
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Rule
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Name:
                  </label>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter rule name..."
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateRule()}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateRule}
                    className="flex items-center px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowAddRuleForm(false);
                      setNewRuleName('');
                    }}
                    className="flex items-center px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Rule ID:</label>
                <span className="text-xs text-gray-500">Auto-generated</span>
              </div>
              <div className="text-sm text-gray-900 bg-white px-3 py-2 border border-gray-300 rounded-md">
                {rule.id}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name:</label>
              {!editingRuleName ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-900 bg-white px-3 py-2 border border-gray-300 rounded-md flex-1">
                    {rule.ruleName}
                  </div>
                  <button
                    onClick={() => setEditingRuleName(rule.ruleName)}
                    className="ml-2 text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingRuleName}
                    onChange={(e) => setEditingRuleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleUpdateRuleName()}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateRuleName}
                      className="flex items-center px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRuleName('')}
                      className="flex items-center px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Annotations Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Annotations</h3>
        {annotations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No annotations yet</p>
            {fileType === 'json' ? (
              <p className="text-sm">Add KEY:VALUE annotations using the form above</p>
            ) : fileType === 'pdf' ? (
              <p className="text-sm">Add keyword annotations using the form above</p>
            ) : fileType === 'audio' ? (
              <p className="text-sm">Select words in the transcript to create audio annotations</p>
            ) : (
              <p className="text-sm">Start drawing bounding boxes to create annotations</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {annotations.map((annotation) => {
              console.log('Rendering annotation in AnnotationList:', annotation); // Debug log
              return (
                <div
                  key={annotation.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {annotation.label || 'Unlabeled'}
                        </span>
                        <span className="text-xs text-gray-500">#{annotation.id.slice(-6)}</span>
                      </div>
                      
                      {/* PDF Annotation Display */}
                      {annotation.annotationType === 'pdf' ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            Page: {annotation.pageNumber ? annotation.pageNumber : 'All Pages'}
                          </div>
                          {annotation.keywordText && (
                            <div className="text-xs text-gray-600">
                              Keyword: &quot;{annotation.keywordText}&quot;
                            </div>
                          )}
                        </div>
                      ) : annotation.annotationType === 'json' ? (
                        /* JSON Annotation Display */
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            Key: &quot;{annotation.jsonKey}&quot;
                          </div>
                          <div className="text-xs text-gray-600">
                            Value: &quot;{annotation.jsonValue}&quot;
                          </div>
                        </div>
                      ) : annotation.annotationType === 'audio_segment' ? (
                        /* Audio Annotation Display */
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            Text: &quot;{annotation.text || annotation.metadata?.text || 'No text'}&quot;
                          </div>
                          <div className="text-xs text-gray-600">
                            Time: {(annotation.startTime || annotation.metadata?.startTime || 0).toFixed(1)}s - {(annotation.endTime || annotation.metadata?.endTime || 0).toFixed(1)}s
                          </div>
                          <div className="text-xs text-gray-600">
                            Duration: {(annotation.metadata?.duration || ((annotation.endTime || 0) - (annotation.startTime || 0))).toFixed(1)}s
                          </div>
                        </div>
                      ) : (
                        /* Image Annotation Display */
                        <>
                          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                            <div>X1: {Math.round(annotation.x1)}</div>
                            <div>Y1: {Math.round(annotation.y1)}</div>
                            <div>X2: {Math.round(annotation.x2)}</div>
                            <div>Y2: {Math.round(annotation.y2)}</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Size: {Math.round(annotation.x2 - annotation.x1)} × {Math.round(annotation.y2 - annotation.y1)}
                          </div>
                        </>
                      )}
                      
                      {/* Show OCR text only for text-based annotations, show Visual Element for visual annotations */}
                      {annotation.annotationType === 'visual' ? (
                        <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs flex flex-col items-start">
                          <div className="font-medium text-purple-900 mb-1">Visual Element:</div>
                          <CroppedImagePreview src={dataURL} x1={annotation.x1} y1={annotation.y1} x2={annotation.x2} y2={annotation.y2} />
                          <div className="text-purple-800 mt-2">Logo/Icon/Graphic</div>
                          <div className="text-purple-600 mt-1">
                            Visual similarity matching enabled
                          </div>
                        </div>
                      ) : annotation.annotationType === 'image' && annotation.ocrText ? (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <div className="font-medium text-blue-900 mb-1">OCR Text:</div>
                          <div className="text-blue-800">{annotation.ocrText}</div>
                          {annotation.ocrConfidence && (
                            <div className="text-blue-600 mt-1">
                              Confidence: {Math.round(annotation.ocrConfidence * 100)}%
                            </div>
                          )}
                        </div>
                      ) : annotation.annotationType === 'image' ? (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <div className="font-medium text-yellow-900 mb-1">Text Annotation:</div>
                          <div className="text-yellow-800">No OCR text detected yet</div>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {/* Only show OCR button for text-based image annotations */}
                      {annotation.annotationType === 'image' && annotation.ocrText && (
                        <button
                          onClick={() => handleOCR(annotation)}
                          disabled={ocrLoading === annotation.id}
                          className="flex items-center px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                          title="Extract text with OCR"
                        >
                          {ocrLoading === annotation.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => onSelectAnnotation(annotation)}
                        className="flex items-center px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                        title="View annotation"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteAnnotation(annotation.id)}
                        className="flex items-center px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                        title="Delete annotation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 