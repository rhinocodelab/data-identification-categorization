export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Rule {
  id: string;
  ruleName: string;
  categoryId?: string;
}

export interface Annotation {
  id: string;
  ruleId: string;
  x1: number; // Integer coordinates for bounding box
  y1: number; // Integer coordinates for bounding box
  x2: number; // Integer coordinates for bounding box
  y2: number; // Integer coordinates for bounding box
  label: string;
  ocrText?: string;
  ocrConfidence?: number;
  // PDF-specific fields
  pageNumber?: number;
  keywordText?: string;
  // JSON-specific fields
  jsonKey?: string;
  jsonValue?: string;
  // Audio-specific fields
  startTime?: number;
  endTime?: number;
  text?: string;
  // Metadata for additional annotation data (used by audio annotations)
  metadata?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    label?: string;
    text?: string;
    wordCount?: number;
    context?: any;
    audioMetadata?: any;
  };
  annotationType?: 'image' | 'pdf' | 'json' | 'visual' | 'audio_segment';
} 