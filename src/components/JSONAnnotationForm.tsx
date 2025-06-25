'use client';

import { useState } from 'react';
import { Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Annotation } from '@/types/annotation';
import toast from 'react-hot-toast';

interface JSONAnnotationFormProps {
  ruleId: string;
  onAddAnnotation: (annotation: Annotation) => void;
  existingAnnotations: Annotation[];
  jsonContent?: string; // JSON content as string
}

// Function to flatten JSON object and get all key-value pairs
const flattenJSON = (obj: any, prefix = ''): { key: string; value: any; path: string }[] => {
  const result: { key: string; value: any; path: string }[] = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        result.push(...flattenJSON(value, currentPath));
      } else if (Array.isArray(value)) {
        // Handle arrays - add array items with index
        value.forEach((item, index) => {
          if (item !== null && typeof item === 'object') {
            result.push(...flattenJSON(item, `${currentPath}[${index}]`));
          } else {
            result.push({
              key: `${currentPath}[${index}]`,
              value: item,
              path: `${currentPath}[${index}]`
            });
          }
        });
      } else {
        // Add simple key-value pair
        result.push({
          key: currentPath,
          value: value,
          path: currentPath
        });
      }
    }
  }
  
  return result;
};

export default function JSONAnnotationForm({ 
  ruleId, 
  onAddAnnotation, 
  existingAnnotations,
  jsonContent 
}: JSONAnnotationFormProps) {
  const [jsonKey, setJsonKey] = useState('');
  const [jsonValue, setJsonValue] = useState('');
  const [label, setLabel] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState('');

  // Function to validate if key-value pair exists in JSON
  const validateKeyValuePair = (key: string, value: string) => {
    if (!jsonContent || !key.trim() || !value.trim()) {
      setValidationStatus('idle');
      setValidationMessage('');
      return;
    }

    try {
      const jsonObj = JSON.parse(jsonContent);
      const flattened = flattenJSON(jsonObj);
      
      // Check if the key-value pair exists (case-insensitive for values)
      const found = flattened.find(item => 
        item.key.toLowerCase() === key.toLowerCase() && 
        String(item.value).toLowerCase() === value.toLowerCase()
      );

      if (found) {
        setValidationStatus('valid');
        setValidationMessage(`✓ Found: ${found.path} = ${found.value}`);
      } else {
        setValidationStatus('invalid');
        setValidationMessage(`✗ Key-value pair not found in JSON`);
        
        // Show available keys for this key name
        const availableKeys = flattened.filter(item => 
          item.key.toLowerCase() === key.toLowerCase()
        );
        
        if (availableKeys.length > 0) {
          setValidationMessage(`✗ Key "${key}" found but value "${value}" not found. Available values: ${availableKeys.map(k => String(k.value)).join(', ')}`);
        }
      }
    } catch (error) {
      setValidationStatus('invalid');
      setValidationMessage('✗ Invalid JSON content');
    }
  };

  // Validate on key or value change
  const handleKeyChange = (newKey: string) => {
    setJsonKey(newKey);
    if (newKey.trim() && jsonValue.trim()) {
      validateKeyValuePair(newKey, jsonValue);
    } else {
      setValidationStatus('idle');
      setValidationMessage('');
    }
  };

  const handleValueChange = (newValue: string) => {
    setJsonValue(newValue);
    if (jsonKey.trim() && newValue.trim()) {
      validateKeyValuePair(jsonKey, newValue);
    } else {
      setValidationStatus('idle');
      setValidationMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jsonKey.trim()) {
      toast.error('Please enter a JSON key');
      return;
    }

    if (!jsonValue.trim()) {
      toast.error('Please enter a JSON value');
      return;
    }

    if (!label.trim()) {
      toast.error('Please enter a label for the annotation');
      return;
    }

    // Validate that the key-value pair exists in the JSON
    if (validationStatus !== 'valid') {
      toast.error('Please ensure the key-value pair exists in the JSON file before adding the annotation');
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

    // Check for duplicate key-value pairs
    const keyValueExists = existingAnnotations.some(annotation => 
      annotation.jsonKey?.toLowerCase() === jsonKey.toLowerCase() &&
      annotation.jsonValue?.toLowerCase() === jsonValue.toLowerCase()
    );
    
    if (keyValueExists) {
      toast.error('This key-value pair already exists. Please use a different combination.');
      return;
    }

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: ruleId,
      x1: 0, // Ignored for JSON annotations
      y1: 0, // Ignored for JSON annotations
      x2: 0, // Ignored for JSON annotations
      y2: 0, // Ignored for JSON annotations
      label: label.trim(),
      jsonKey: jsonKey.trim(),
      jsonValue: jsonValue.trim(),
      annotationType: 'json'
    };

    onAddAnnotation(newAnnotation);
    
    // Reset form
    setJsonKey('');
    setJsonValue('');
    setLabel('');
    setValidationStatus('idle');
    setValidationMessage('');
    toast.success(`JSON annotation "${label}" added successfully!`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Add JSON Key-Value Annotation</h3>
      
      {!jsonContent && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 inline mr-1" />
          JSON content not available. Validation will be disabled.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            JSON Key:
          </label>
          <input
            type="text"
            value={jsonKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="Enter the JSON key (e.g., 'name', 'type', 'status')..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            JSON Value:
          </label>
          <input
            type="text"
            value={jsonValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter the expected JSON value..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Validation Status */}
        {validationStatus !== 'idle' && (
          <div className={`p-2 rounded text-sm flex items-center ${
            validationStatus === 'valid' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {validationStatus === 'valid' ? (
              <CheckCircle className="h-4 w-4 mr-1" />
            ) : (
              <AlertCircle className="h-4 w-4 mr-1" />
            )}
            {validationMessage}
          </div>
        )}

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
            disabled={jsonContent ? validationStatus !== 'valid' : false}
            className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            Add Annotation
          </button>
          
          <button
            type="button"
            onClick={() => { 
              setLabel(''); 
              setJsonKey(''); 
              setJsonValue(''); 
              setValidationStatus('idle');
              setValidationMessage('');
            }}
            className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
} 