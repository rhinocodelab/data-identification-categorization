'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import AnnotationCanvas from '@/components/AnnotationCanvas';
import PDFViewer from '@/components/PDFViewer';
import JSONViewer from '@/components/JSONViewer';
import AudioViewer from '@/components/AudioViewer';
import KeywordAnnotationForm from '@/components/KeywordAnnotationForm';
import JSONAnnotationForm from '@/components/JSONAnnotationForm';
import AnnotationList from '@/components/AnnotationList';
import CategorySelector from '@/components/CategorySelector';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import { Rule, Annotation, Category } from '@/types/annotation';
import { Plus, Save, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface DataFile {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  fileType?: 'image' | 'pdf' | 'json' | 'audio';
  type?: string;
}

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

interface AudioAnnotation {
  id: string;
  startTime: number;
  endTime: number;
  label: string;
  text: string;
}

export default function AnnotatePage() {
  const params = useParams();
  const dataId = params.dataId as string;
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'json' | 'audio' | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [audioAnnotations, setAudioAnnotations] = useState<AudioAnnotation[]>([]);
  const [selectedAudioAnnotation, setSelectedAudioAnnotation] = useState<AudioAnnotation | null>(null);
  const hasLoadedAnnotationsRef = useRef(false);
  const [autoCategoryResult, setAutoCategoryResult] = useState<null | { categoryId: string, categoryName: string, confidence: number, reason: string }>(null);
  const [autoCategorizeLoading, setAutoCategorizeLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch JSON content for validation
  const fetchJSONContent = async (jsonUrl: string) => {
    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JSON: ${response.statusText}`);
      }
      const content = await response.text();
      setJsonContent(content);
    } catch (error) {
      console.error('Error fetching JSON content:', error);
      setJsonContent('');
    }
  };

  const fetchFile = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Fetch file metadata from the images API
      const response = await fetch('/api/images');
      if (!response.ok) {
        throw new Error('Failed to fetch data files');
      }
      
      const files: DataFile[] = await response.json();
      const file = files.find((f: DataFile) => f.filename === dataId);
      
      if (!file) {
        setError('Data file not found');
        return;
      }
      
      setSelectedFile(file.url);
      
      // Determine file type from metadata
      let detectedFileType: 'image' | 'pdf' | 'json' | 'audio' = 'image';
      if (file.fileType) {
        detectedFileType = file.fileType;
      } else if (file.type) {
        const type = file.type.toLowerCase();
        if (type.includes('pdf')) {
          detectedFileType = 'pdf';
        } else if (type.includes('json')) {
          detectedFileType = 'json';
        } else if (type.includes('audio')) {
          detectedFileType = 'audio';
        } else {
          detectedFileType = 'image';
        }
      } else if (file.filename) {
        const extension = file.filename.toLowerCase().split('.').pop();
        if (extension === 'pdf') {
          detectedFileType = 'pdf';
        } else if (extension === 'json') {
          detectedFileType = 'json';
        } else if (extension === 'audio') {
          detectedFileType = 'audio';
        } else {
          detectedFileType = 'image';
        }
      }
      
      setFileType(detectedFileType);
      
      // Fetch JSON content for validation if it's a JSON file
      if (detectedFileType === 'json') {
        await fetchJSONContent(file.url);
      }
      
      // Get image dimensions for images
      if (detectedFileType === 'image') {
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
        };
        img.onerror = () => {
          console.warn('Could not load image to get dimensions');
        };
        img.src = file.url;
      }

      // Fetch transcript for audio files
      if (detectedFileType === 'audio') {
        await fetchTranscript(file.url);
      }
      
    } catch (error) {
      console.error('Error fetching file:', error);
      setError('Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataId) {
      fetchFile();
    }
  }, [dataId]);

  // Get image dimensions when image URL is set (only for images)
  useEffect(() => {
    if (selectedFile && fileType === 'image') {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = selectedFile;
    }
  }, [selectedFile, fileType]);

  // Load existing annotation data from database - only once when component mounts
  useEffect(() => {
    const loadAnnotationData = async () => {
      if (!dataId || !selectedFile || loading || loadingAnnotations || hasLoadedAnnotationsRef.current) return;

      try {
        setLoadingAnnotations(true);
        hasLoadedAnnotationsRef.current = true;
        
        const response = await fetch(`/api/annotations/load/${dataId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const { 
              rule: savedRule, 
              annotations: savedAnnotations, 
              imageDimensions: savedDimensions,
              transcript: savedTranscript,
              audioMetadata: savedAudioMetadata
            } = result.data;
            
            // Load the rule
            if (savedRule) {
              setRule(savedRule);
              // Set the selected category from the saved rule
              setSelectedCategoryId(savedRule.categoryId);
            }
            
            // Load the annotations based on file type
            if (savedAnnotations && savedAnnotations.length > 0) {
              if (fileType === 'audio') {
                // For audio files, load audio annotations
                const audioAnnotations = savedAnnotations.map((ann: any) => ({
                  id: ann.id,
                  startTime: ann.startTime,
                  endTime: ann.endTime,
                  label: ann.label,
                  text: ann.text
                }));
                setAudioAnnotations(audioAnnotations);
              } else {
                // For other file types, load regular annotations
                setAnnotations(savedAnnotations);
              }
            }
            
            // Load transcript for audio files
            if (fileType === 'audio' && savedTranscript) {
              setTranscript(savedTranscript);
            }
            
            // Load image dimensions if not already set (for images)
            if (savedDimensions && !imageDimensions && fileType === 'image') {
              setImageDimensions(savedDimensions);
            }
          }
        } else if (response.status === 404) {
          // No existing data found - this is normal for new files
          console.log('No existing annotation data found for this file');
        } else {
          const errorData = await response.json();
          toast.error(`Failed to load annotation data: ${errorData.error}`);
        }
      } catch (error) {
        console.error('Error loading annotation data:', error);
        toast.error('Failed to load existing annotation data');
      } finally {
        setLoadingAnnotations(false);
        setAnnotationsLoaded(true);
      }
    };

    // Only load once when component is ready
    if (selectedFile && !loading) {
      loadAnnotationData();
    }
  }, [dataId, selectedFile, loading, fileType, imageDimensions, loadingAnnotations]);

  // If no annotation loading is needed (no existing data), set as loaded
  useEffect(() => {
    if (selectedFile && !loading && !loadingAnnotations && !hasLoadedAnnotationsRef.current) {
      setAnnotationsLoaded(true);
    }
  }, [selectedFile, loading, loadingAnnotations]);

  const handleAnnotationComplete = async (annotation: Annotation) => {
    if (rule) {
      const newAnnotation: Annotation = {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        annotationType: annotation.annotationType || 'image'
      };
      
      // Add the annotation to the list
      setAnnotations(prev => [...prev, newAnnotation]);
      toast.success(`Annotation "${annotation.label}" saved successfully!`);
      
      // Automatically generate OCR text for images
      if (fileType === 'image' && annotation.annotationType !== 'visual') {
        try {
          // Debug: Log annotation type before OCR logic
          console.log('Generating OCR for text-based annotation:', newAnnotation.id);
          
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imagePath: selectedFile,
              boundingBox: {
                x1: Math.round(annotation.x1),
                y1: Math.round(annotation.y1),
                x2: Math.round(annotation.x2),
                y2: Math.round(annotation.y2),
              },
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('OCR Result for annotation', newAnnotation.id, ':', result);
            
            if (result.success) {
              // Update the annotation in the list with OCR result
              setAnnotations(prev =>
                prev.map(ann =>
                  ann.id === newAnnotation.id
                    ? { ...ann, ocrText: result.text || '', ocrConfidence: result.confidence || 0 }
                    : ann
                )
              );
              
              if (result.text) {
                toast.success(`OCR completed: "${result.text}"`);
              } else {
                toast.success('No text detected in this region');
              }
            }
          }
        } catch (error) {
          console.error('OCR Error for annotation', newAnnotation.id, ':', error);
          // Don't show error toast for OCR failure - it's optional
        }
      }
    }
    setCurrentAnnotation(null);
  };

  const handleKeywordAnnotationAdd = (annotation: Annotation) => {
    if (rule) {
      const newAnnotation: Annotation = {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        annotationType: annotation.annotationType || 'pdf'
      };
      
      console.log('Adding annotation:', newAnnotation);
      setAnnotations(prev => [...prev, newAnnotation]);
      
      // Show appropriate success message based on annotation type
      if (annotation.annotationType === 'json') {
        toast.success(`JSON annotation "${annotation.label}" added successfully!`);
      } else {
        toast.success(`Keyword annotation "${annotation.label}" added successfully!`);
      }
    } else {
      console.error('No rule available for annotation');
      toast.error('Please create a rule before adding annotations');
    }
  };

  const handleAnnotationDelete = (id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    toast.success('Annotation deleted successfully!');
  };

  const handleCreateRule = (ruleName: string) => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      ruleName: ruleName,
      categoryId: selectedCategoryId
    };
    setRule(newRule);
    toast.success(`Rule "${ruleName}" created successfully!`);
  };

  const handleUpdateRule = (updatedRule: Rule) => {
    setRule(updatedRule);
  };

  const handleCategoryChange = (categoryId: string | undefined) => {
    setSelectedCategoryId(categoryId);
    // Update the rule with the new category (if rule exists)
    if (rule) {
      setRule({
        ...rule,
        categoryId: categoryId
      });
    }
    // If no rule exists yet, the categoryId will be included when rule is created
  };

  // Audio-specific handlers
  const handleAudioAnnotationAdd = (annotation: AudioAnnotation) => {
    setAudioAnnotations(prev => [...prev, annotation]);
    toast.success(`Audio annotation "${annotation.label}" added successfully!`);
  };

  const handleAudioAnnotationSelect = (annotation: AudioAnnotation | null) => {
    setSelectedAudioAnnotation(annotation);
  };

  const handleAudioAnnotationDelete = (id: string) => {
    setAudioAnnotations(prev => prev.filter(ann => ann.id !== id));
    toast.success('Audio annotation deleted successfully!');
  };

  // Fetch transcript for audio files
  const fetchTranscript = async (audioUrl: string) => {
    try {
      console.log('Fetching transcript for:', audioUrl);
      
      // Get the audio file from the server
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio file');
      }
      
      const audioBlob = await audioResponse.blob();
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      
      // Create form data for the transcription API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      
      console.log('Calling transcription API...');
      
      // Call the transcription API
      const transcriptResponse = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Transcription response status:', transcriptResponse.status);
      
      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text();
        console.error('Transcription error response:', errorText);
        throw new Error('Transcription failed: ' + errorText);
      }
      
      const result = await transcriptResponse.json();
      console.log('Transcription result:', result);
      
      if (result.success && result.transcript) {
        console.log('Setting transcript with', result.transcript.length, 'words');
        setTranscript(result.transcript);
        toast.success('Transcript loaded successfully!');
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
      toast.error('Failed to load transcript: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      // Fallback to mock transcript for testing
      const mockTranscript: Word[] = [
        { word: "Hello", startTime: 0, endTime: 0.5 },
        { word: "world", startTime: 0.5, endTime: 1.0 },
        { word: "this", startTime: 1.0, endTime: 1.3 },
        { word: "is", startTime: 1.3, endTime: 1.5 },
        { word: "a", startTime: 1.5, endTime: 1.6 },
        { word: "test", startTime: 1.6, endTime: 2.0 },
        { word: "audio", startTime: 2.0, endTime: 2.5 },
        { word: "file", startTime: 2.5, endTime: 3.0 },
      ];
      setTranscript(mockTranscript);
      toast.success('Using sample transcript for testing');
    }
  };

  const saveAnnotations = async () => {
    if (!rule) {
      toast.error('Please create a rule before saving annotations.');
      return;
    }

    // For audio files, we need transcript and audio annotations
    if (fileType === 'audio') {
      if (audioAnnotations.length === 0) {
        toast.error('No audio annotations to save. Please create some annotations first.');
        return;
      }
      if (transcript.length === 0) {
        toast.error('No transcript available. Please ensure the audio file has been transcribed.');
        return;
      }
    } else {
      if (annotations.length === 0) {
        toast.error('No annotations to save. Please create some annotations first.');
        return;
      }
    }

    try {
      // Show loading state
      toast.loading('Saving annotations...', { id: 'save-loading' });

      // Debug: Log annotations before saving
      console.log('Annotations to save:', annotations);
      console.log('Audio annotations to save:', audioAnnotations);
      console.log('File type:', fileType);

      // Handle different file types
      if (fileType === 'audio') {
        // Save audio-specific annotations with comprehensive data for auto-categorization
        const audioSavePayload = {
          rule: rule,
          annotations: audioAnnotations.map(ann => ({
            ...ann,
            annotationType: 'audio_segment',
            // Add metadata for auto-categorization
            metadata: {
              startTime: ann.startTime,
              endTime: ann.endTime,
              duration: ann.endTime - ann.startTime,
              label: ann.label,
              text: ann.text,
              wordCount: ann.text.split(' ').length,
              // Extract surrounding context from transcript
              context: extractAudioContext(transcript, ann.startTime, ann.endTime),
              // Audio file metadata
              audioMetadata: {
                fileId: dataId,
                fileUrl: selectedFile,
                totalDuration: transcript.length > 0 ? transcript[transcript.length - 1].endTime : 0,
                totalWords: transcript.length,
                language: 'en-US', // Default, could be made configurable
                sampleRate: 48000, // From the WAV file, could be detected
                channels: 1, // Mono, could be detected
                fileSize: selectedFile ? selectedFile.length : 0
              }
            }
          })),
          dataId: dataId,
          dataURL: selectedFile,
          fileType: fileType,
          // Include full transcript for auto-categorization
          transcript: transcript,
          // Audio-specific metadata
          audioMetadata: {
            totalDuration: transcript.length > 0 ? transcript[transcript.length - 1].endTime : 0,
            totalWords: transcript.length,
            language: 'en-US',
            sampleRate: 48000,
            channels: 1,
            fileSize: selectedFile ? selectedFile.length : 0,
            // Full transcript text for text-based categorization
            fullTranscriptText: transcript.map(word => word.word).join(' '),
            // Word-level timing for detailed analysis
            wordTimings: transcript.map(word => ({
              word: word.word,
              startTime: word.startTime,
              endTime: word.endTime,
              duration: word.endTime - word.startTime
            })),
            // Statistical features for ML
            statistics: {
              averageWordDuration: transcript.length > 0 ? 
                transcript.reduce((sum, word) => sum + (word.endTime - word.startTime), 0) / transcript.length : 0,
              speechRate: transcript.length > 0 ? 
                transcript.length / (transcript[transcript.length - 1].endTime / 60) : 0, // words per minute
              pauseCount: countPauses(transcript),
              uniqueWords: new Set(transcript.map(word => word.word.toLowerCase())).size,
              vocabularyDiversity: transcript.length > 0 ? 
                new Set(transcript.map(word => word.word.toLowerCase())).size / transcript.length : 0
            }
          }
        };

        console.log('Audio save payload:', audioSavePayload);
        
        const response = await fetch('/api/annotations/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(audioSavePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Save response error:', errorData);
          throw new Error(errorData.error || 'Failed to save audio annotations');
        }

        const result = await response.json();
        console.log('Audio save result:', result);
        
        // Dismiss loading toast and show success
        toast.dismiss('save-loading');
        toast.success(`Audio annotations saved successfully! ${audioAnnotations.length} segment(s) annotated.`);
        
        return;
      }

      // Handle other file types (image, PDF, JSON)
      // Validate annotations structure
      const invalidAnnotations = annotations.filter(ann => {
        if (fileType === 'pdf') {
          return !ann.keywordText || !ann.annotationType;
        } else if (fileType === 'json') {
          return !ann.jsonKey || !ann.jsonValue || !ann.annotationType;
        } else {
          return !ann.x1 || !ann.y1 || !ann.x2 || !ann.y2;
        }
      });

      if (invalidAnnotations.length > 0) {
        console.error('Invalid annotations found:', invalidAnnotations);
        toast.dismiss('save-loading');
        toast.error('Some annotations have invalid data. Please check and try again.');
        return;
      }

      // For images, generate OCR for annotations that don't have OCR text
      let annotationsToSave = annotations;
      
      if (fileType === 'image') {
        annotationsToSave = await Promise.all(
          annotations.map(async (annotation) => {
            // If annotation already has OCR text, keep it
            if (annotation.ocrText) {
              return annotation;
            }

            // Debug: Log annotation type before OCR logic
            console.log('Annotation before OCR logic:', annotation);

            // For visual-only annotations (like logos), OCR is optional
            // Only generate OCR if the user hasn't explicitly marked it as visual-only
            if (annotation.annotationType === 'visual') {
              console.log('Skipping OCR for visual-only annotation:', annotation.id);
              return {
                ...annotation,
                ocrText: '', // Empty for visual-only annotations
                ocrConfidence: 0,
              };
            }

            // Generate OCR for annotations without OCR text (text-based annotations)
            try {
              console.log('Generating OCR for text-based annotation:', annotation.id);
              const response = await fetch('/api/ocr', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imagePath: selectedFile,
                  boundingBox: {
                    x1: Math.round(annotation.x1),
                    y1: Math.round(annotation.y1),
                    x2: Math.round(annotation.x2),
                    y2: Math.round(annotation.y2),
                  },
                }),
              });

              if (response.ok) {
                const result = await response.json();
                console.log('OCR Result for annotation', annotation.id, ':', result);
                
                if (result.success) {
                  return {
                    ...annotation,
                    ocrText: result.text || '',
                    ocrConfidence: result.confidence || 0,
                  };
                }
              }
            } catch (error) {
              console.error('OCR Error for annotation', annotation.id, ':', error);
            }

            // Return original annotation if OCR failed
            return annotation;
          })
        );

        // Update local state with OCR results
        setAnnotations(annotationsToSave);
      }

      // Debug: Log final annotations to save
      console.log('Final annotations to save:', annotationsToSave);

      // Save all annotations to database
      console.log('Saving rule with categoryId:', rule.categoryId);
      console.log('Full rule data:', rule);
      
      const savePayload = {
        rule: rule,
        annotations: annotationsToSave,
        dataId: dataId,
        dataURL: selectedFile,
        dataDimensions: imageDimensions,
        fileType: fileType
      };

      console.log('Save payload:', savePayload);
      
      const response = await fetch('/api/annotations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save response error:', errorData);
        throw new Error(errorData.error || 'Failed to save annotations');
      }

      const result = await response.json();
      console.log('Save result:', result);
      
      // Dismiss loading toast and show success
      toast.dismiss('save-loading');
      toast.success(result.message);
      
      // Show summary for images
      if (fileType === 'image') {
        const annotationsWithText = annotationsToSave.filter(ann => ann.ocrText && ann.ocrText.trim());
        const annotationsWithoutText = annotationsToSave.filter(ann => !ann.ocrText || !ann.ocrText.trim());
        
        if (annotationsWithText.length > 0) {
          toast.success(`${annotationsWithText.length} annotation(s) have OCR text extracted`);
        }
        if (annotationsWithoutText.length > 0) {
          toast.success(`${annotationsWithoutText.length} annotation(s) have no text detected`);
        }
      }

    } catch (error) {
      // Dismiss loading toast and show error
      toast.dismiss('save-loading');
      const errorMessage = error instanceof Error ? error.message : 'Failed to save annotations';
      console.error('Save error:', error);
      toast.error(`Save failed: ${errorMessage}`);
    }
  };

  // Helper function to extract context around audio annotations
  const extractAudioContext = (transcript: Word[], startTime: number, endTime: number, contextWindow: number = 2.0) => {
    const contextStart = Math.max(0, startTime - contextWindow);
    const contextEnd = endTime + contextWindow;
    
    const contextWords = transcript.filter(word => 
      word.startTime >= contextStart && word.endTime <= contextEnd
    );
    
    return {
      beforeContext: transcript.filter(word => 
        word.endTime < startTime && word.startTime >= contextStart
      ).map(word => word.word).join(' '),
      afterContext: transcript.filter(word => 
        word.startTime > endTime && word.endTime <= contextEnd
      ).map(word => word.word).join(' '),
      fullContext: contextWords.map(word => word.word).join(' ')
    };
  };

  // Helper function to count pauses in transcript
  const countPauses = (transcript: Word[], pauseThreshold: number = 0.5) => {
    let pauseCount = 0;
    for (let i = 1; i < transcript.length; i++) {
      const gap = transcript[i].startTime - transcript[i-1].endTime;
      if (gap > pauseThreshold) {
        pauseCount++;
      }
    }
    return pauseCount;
  };

  const refreshAnnotationData = async () => {
    if (!dataId || loadingAnnotations) return;

    try {
      setLoadingAnnotations(true);
      hasLoadedAnnotationsRef.current = false; // Reset for manual refresh
      
      const response = await fetch(`/api/annotations/load/${dataId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const { rule: savedRule, annotations: savedAnnotations } = result.data;
          
          // Load the rule
          if (savedRule) {
            setRule(savedRule);
            // Set the selected category from the saved rule
            setSelectedCategoryId(savedRule.categoryId);
          }
          
          // Load the annotations
          if (savedAnnotations) {
            setAnnotations(savedAnnotations);
          }
          
          toast.success('Annotation data refreshed successfully!');
        }
      } else if (response.status === 404) {
        // Clear existing data if none found
        setRule(null);
        setAnnotations([]);
        toast.success('No saved annotation data found. Starting fresh.');
      } else {
        const errorData = await response.json();
        toast.error(`Failed to refresh data: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error refreshing annotation data:', error);
      toast.error('Failed to refresh annotation data');
    } finally {
      setLoadingAnnotations(false);
      setAnnotationsLoaded(true);
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setCategories(result.data);
          }
        } else {
          console.error('Failed to load categories');
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Auto Categorize handler for audio
  const handleAutoCategorize = async () => {
    if (!dataId || fileType !== 'audio') return;
    setAutoCategorizeLoading(true);
    setAutoCategoryResult(null);
    try {
      const response = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: dataId, fileType: 'audio' })
      });
      const result = await response.json();
      if (result.success) {
        setAutoCategoryResult(result);
        toast.success(`Predicted: ${result.category} (${Math.round(result.confidence * 100)}%)`);
        // Auto-select the category if it exists
        if (result.category && categories.length > 0) {
          const match = categories.find(cat => cat.name === result.category);
          if (match) setSelectedCategoryId(match.id);
        }
      } else {
        toast.error(result.error || 'Auto-categorization failed');
      }
    } catch (err) {
      toast.error('Auto-categorization failed');
    } finally {
      setAutoCategorizeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading file...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner while annotations are being loaded
  if (loadingAnnotations || !annotationsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading annotation data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Header */}
      <Header />

      {/* Page Content */}
      <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: 'Data Files', href: '/' },
            { label: 'Annotation' }
          ]} 
        />
        
        {/* Page Title and Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-1.5xl font-bold text-gray-900">Data Annotation</h1>
              <p className="text-gray-600 mt-1">File ID: {dataId}</p>
              <p className="text-gray-600 text-sm">Type: {fileType?.toUpperCase()}</p>
              {imageDimensions && fileType === 'image' && (
                <p className="text-gray-600 text-sm">Size: {imageDimensions.width} × {imageDimensions.height} pixels</p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {fileType === 'image' && (
                <button
                  onClick={() => {
                    if (rule) {
                      setCurrentAnnotation({ 
                        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
                        ruleId: rule.id,
                        x1: 0, 
                        y1: 0, 
                        x2: 0, 
                        y2: 0, 
                        label: '' 
                      });
                    }
                  }}
                  disabled={!rule}
                  className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  New Annotation
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={refreshAnnotationData}
                  disabled={loadingAnnotations}
                  className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                  title="Refresh annotation data from database"
                >
                  Refresh
                </button>
                <button
                  onClick={saveAnnotations}
                  className="flex items-center justify-center px-2 py-1 text-xs rounded w-28 bg-green-600 text-white hover:bg-green-700 transition-colors"
                  title="Save current annotations to database"
                >
                  Save
                </button>
                {fileType === 'audio' && !selectedFile?.includes('/data/audio/') && (
                  <button
                    onClick={handleAutoCategorize}
                    disabled={autoCategorizeLoading}
                    className="flex items-center justify-center px-2 py-1 text-xs rounded w-36 bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:bg-purple-400 disabled:cursor-not-allowed"
                    title="Auto-categorize this audio file"
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    {autoCategorizeLoading ? 'Categorizing...' : 'Auto Categorize'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Category and Rules */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Data Category</h2>
              <div className="max-h-60 overflow-y-auto">
                <CategorySelector 
                  selectedCategoryId={selectedCategoryId}
                  onCategoryChange={handleCategoryChange}
                  categories={categories}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Annotation Rules</h2>
              <AnnotationList
                rule={rule}
                annotations={fileType === 'audio'
                  ? audioAnnotations.map(ann => ({
                      id: ann.id,
                      ruleId: rule?.id || '',
                      x1: 0, y1: 0, x2: 0, y2: 0,
                      label: ann.label,
                      annotationType: 'audio_segment',
                      startTime: ann.startTime,
                      endTime: ann.endTime,
                      text: ann.text,
                      // Add any other required fields as needed
                    }))
                  : annotations}
                dataURL={selectedFile || ''}
                fileType={fileType || 'image'}
                onDeleteAnnotation={fileType === 'audio' ? handleAudioAnnotationDelete : handleAnnotationDelete}
                onSelectAnnotation={fileType === 'audio' ? (ann => handleAudioAnnotationSelect(ann as any)) : setCurrentAnnotation}
                onUpdateRule={handleUpdateRule}
                onCreateRule={handleCreateRule}
                onUpdateAnnotation={(updatedAnnotation) => {
                  if (fileType === 'audio') {
                    setAudioAnnotations(prev =>
                      prev.map(ann =>
                        ann.id === updatedAnnotation.id
                          ? { ...ann, ...updatedAnnotation }
                          : ann
                      )
                    );
                  } else {
                    setAnnotations(prev =>
                      prev.map(ann =>
                        ann.id === updatedAnnotation.id ? updatedAnnotation : ann
                      )
                    );
                  }
                }}
              />
            </div>
          </div>

          {/* Main Area - File Viewer and Annotation */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              {selectedFile && (
                <>
                  {fileType === 'pdf' ? (
                    <>
                      {/* Keyword Annotation Form for PDFs */}
                      {rule && (
                        <KeywordAnnotationForm
                          ruleId={rule.id}
                          currentPage={currentPage}
                          onAddAnnotation={handleKeywordAnnotationAdd}
                          existingAnnotations={annotations}
                        />
                      )}
                      <PDFViewer
                        pdfUrl={selectedFile}
                        onPageChange={setCurrentPage}
                        currentPage={currentPage}
                      />
                    </>
                  ) : fileType === 'json' ? (
                    <>
                      {/* JSON Annotation Form for JSON files */}
                      {rule && (
                        <JSONAnnotationForm
                          ruleId={rule.id}
                          onAddAnnotation={handleKeywordAnnotationAdd}
                          existingAnnotations={annotations}
                          jsonContent={jsonContent}
                        />
                      )}
                      <JSONViewer
                        jsonUrl={selectedFile || ''}
                      />
                    </>
                  ) : fileType === 'audio' ? (
                    <>
                      <AudioViewer
                        audioUrl={selectedFile}
                        transcript={transcript}
                        annotations={audioAnnotations}
                        onAddAnnotation={handleAudioAnnotationAdd}
                        onSelectAnnotation={handleAudioAnnotationSelect}
                        selectedAnnotation={selectedAudioAnnotation}
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold mb-4 text-gray-900">Annotation Canvas</h2>
                      <AnnotationCanvas
                        dataURL={selectedFile || ''}
                        annotations={annotations}
                        currentAnnotation={currentAnnotation}
                        onAnnotationComplete={handleAnnotationComplete}
                        onAnnotationUpdate={setCurrentAnnotation}
                        onAnnotationCancel={() => setCurrentAnnotation(null)}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 