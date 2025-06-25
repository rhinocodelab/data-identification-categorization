'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Image, Rect, Transformer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { Annotation } from '@/types/annotation';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

interface AnnotationCanvasProps {
  dataURL: string;
  annotations: Annotation[];
  currentAnnotation: Annotation | null;
  onAnnotationComplete: (annotation: Annotation) => void;
  onAnnotationUpdate: (annotation: Annotation | null) => void;
  onAnnotationCancel: () => void;
}

export default function AnnotationCanvas({
  dataURL,
  annotations,
  currentAnnotation,
  onAnnotationComplete,
  onAnnotationUpdate,
  onAnnotationCancel
}: AnnotationCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.src = dataURL;
    img.onload = () => {
      setImage(img);
    };
  }, [dataURL]);

  // Handle transformer
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node as Konva.Node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!currentAnnotation) return;

    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    
    setIsDrawing(true);
    
    const newAnnotation: Annotation = {
      ...currentAnnotation,
      id: `annotation-${Date.now()}`,
      x1: pos.x,
      y1: pos.y,
      x2: pos.x,
      y2: pos.y,
      annotationType: currentAnnotation.annotationType || 'image',
    };
    
    onAnnotationUpdate(newAnnotation);
  }, [currentAnnotation, onAnnotationUpdate]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !currentAnnotation) return;

    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    
    const updatedAnnotation: Annotation = {
      ...currentAnnotation,
      x2: pos.x,
      y2: pos.y,
    };
    
    onAnnotationUpdate(updatedAnnotation);
  }, [isDrawing, currentAnnotation, onAnnotationUpdate]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentAnnotation) return;

    setIsDrawing(false);
    
    // Don't automatically complete the annotation - let user click Save button
    // The annotation will remain in currentAnnotation state for manual saving
  }, [isDrawing, currentAnnotation]);

  const handleRectClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }, []);

  if (!image) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading data file...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-gray-300 rounded-lg overflow-auto max-h-[70vh] max-w-full">
        <Stage
          ref={stageRef}
          width={image.width}
          height={image.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleStageClick}
        >
          <Layer>
            <Image
              image={image}
              width={image.width}
              height={image.height}
              alt="Annotation canvas background"
            />
            
            {/* Render existing annotations */}
            {annotations.map((annotation) => (
              <Rect
                key={annotation.id}
                id={annotation.id}
                x={annotation.x1}
                y={annotation.y1}
                width={annotation.x2 - annotation.x1}
                height={annotation.y2 - annotation.y1}
                stroke={selectedId === annotation.id ? "#34A853" : "#EA4335"}
                strokeWidth={2}
                fill="rgba(234, 67, 53, 0.1)"
                onClick={() => handleRectClick(annotation.id)}
                draggable
              />
            ))}
            
            {/* Render current annotation being drawn */}
            {currentAnnotation && (
              <Rect
                x={currentAnnotation.x1}
                y={currentAnnotation.y1}
                width={currentAnnotation.x2 - currentAnnotation.x1}
                height={currentAnnotation.y2 - currentAnnotation.y1}
                stroke="#4285F4"
                strokeWidth={2}
                fill="rgba(66, 133, 244, 0.1)"
                dash={[5, 5]}
              />
            )}
            
            <Transformer ref={transformerRef} />
          </Layer>
        </Stage>
      </div>
      
      {/* Annotation Info */}
      {currentAnnotation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Current Annotation</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-800 font-medium">X1: {Math.round(currentAnnotation.x1)}</div>
            <div className="text-gray-800 font-medium">Y1: {Math.round(currentAnnotation.y1)}</div>
            <div className="text-gray-800 font-medium">X2: {Math.round(currentAnnotation.x2)}</div>
            <div className="text-gray-800 font-medium">Y2: {Math.round(currentAnnotation.y2)}</div>
          </div>
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Label:
            </label>
            <input
              type="text"
              value={currentAnnotation.label}
              onChange={(e) => onAnnotationUpdate({
                ...currentAnnotation,
                label: e.target.value
              })}
              className="w-full px-3 py-1 border border-blue-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter label..."
            />
          </div>
          
          {/* Annotation Type Selection */}
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Annotation Type:
            </label>
            <div className="flex space-x-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="annotationType"
                  value="image"
                  checked={currentAnnotation.annotationType === 'image'}
                  onChange={() => onAnnotationUpdate({
                    ...currentAnnotation,
                    annotationType: 'image'
                  })}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Text (OCR)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="annotationType"
                  value="visual"
                  checked={currentAnnotation.annotationType === 'visual'}
                  onChange={() => onAnnotationUpdate({
                    ...currentAnnotation,
                    annotationType: 'visual'
                  })}
                  className="mr-2 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Visual (Logo/Icon)</span>
              </label>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {currentAnnotation.annotationType === 'visual' 
                ? 'Visual similarity matching will be used for auto-categorization'
                : 'OCR text extraction will be performed for auto-categorization'
              }
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => {
                // Validate and normalize the annotation before saving
                const width = Math.abs(currentAnnotation.x2 - currentAnnotation.x1);
                const height = Math.abs(currentAnnotation.y2 - currentAnnotation.y1);
                
                if (width <= 5 || height <= 5) {
                  toast.error('Annotation is too small. Please draw a larger bounding box.');
                  return;
                }
                
                // Check for duplicate labels
                const labelExists = annotations.some(annotation => 
                  annotation.label.toLowerCase() === currentAnnotation.label.toLowerCase()
                );
                
                if (labelExists) {
                  toast.error('An annotation with this label already exists. Please use a different label.');
                  return;
                }
                
                // Normalize coordinates (ensure x1,y1 is top-left, x2,y2 is bottom-right)
                const normalizedAnnotation: Annotation = {
                  ...currentAnnotation,
                  x1: Math.round(Math.min(currentAnnotation.x1, currentAnnotation.x2)),
                  y1: Math.round(Math.min(currentAnnotation.y1, currentAnnotation.y2)),
                  x2: Math.round(Math.max(currentAnnotation.x1, currentAnnotation.x2)),
                  y2: Math.round(Math.max(currentAnnotation.y1, currentAnnotation.y2)),
                };
                console.log('Saving annotation:', normalizedAnnotation);
                onAnnotationComplete(normalizedAnnotation);
              }}
              className="flex items-center px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
            >
              Save Annotation
            </button>
            <button
              onClick={() => onAnnotationCancel()}
              className="px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 