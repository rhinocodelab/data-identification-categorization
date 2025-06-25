'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Annotation } from '@/types/annotation';
import toast from 'react-hot-toast';

interface KeywordAnnotationFormProps {
  ruleId: string;
  currentPage: number;
  onAddAnnotation: (annotation: Annotation) => void;
  existingAnnotations: Annotation[];
}

export default function KeywordAnnotationForm({ 
  ruleId, 
  currentPage, 
  onAddAnnotation, 
  existingAnnotations 
}: KeywordAnnotationFormProps) {
  const [keywordText, setKeywordText] = useState('');
  const [label, setLabel] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keywordText.trim()) {
      toast.error('Please enter keyword text');
      return;
    }

    if (!label.trim()) {
      toast.error('Please enter a label for the annotation');
      return;
    }

    // Check for duplicate labels
    const labelExists = existingAnnotations.some(annotation => 
      annotation.label.toLowerCase() === label.toLowerCase()
    );
    
    if (labelExists) {
      toast.error('An annotation with this label already exists. Please use a different label.');
      return;
    }

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: ruleId,
      x1: 0, // Not used for PDF annotations
      y1: 0, // Not used for PDF annotations
      x2: 0, // Not used for PDF annotations
      y2: 0, // Not used for PDF annotations
      label: label.trim(),
      keywordText: keywordText.trim(),
      pageNumber: undefined, // No page number - search all pages
      annotationType: 'pdf'
    };

    onAddAnnotation(newAnnotation);
    
    // Reset form
    setKeywordText('');
    setLabel('');
    toast.success(`Keyword annotation "${label}" added successfully!`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Add Keyword Annotation</h3>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keyword Text:
          </label>
          <textarea
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
            placeholder="Enter the keyword or text to annotate..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label:
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter a label for this annotation..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            Add Annotation
          </button>
          
          <button
            type="button"
            onClick={() => { setLabel(''); setKeywordText(''); }}
            className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
} 