'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, FileAudio } from 'lucide-react';

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

interface AudioViewerProps {
  audioUrl: string;
  transcript: Word[];
  annotations: AudioAnnotation[];
  onAddAnnotation: (annotation: AudioAnnotation) => void;
  onSelectAnnotation: (annotation: AudioAnnotation | null) => void;
  selectedAnnotation: AudioAnnotation | null;
}

export default function AudioViewer({
  audioUrl,
  transcript,
  annotations,
  onAddAnnotation,
  onSelectAnnotation,
  selectedAnnotation
}: AudioViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Debug logging to check transcript data types
  React.useEffect(() => {
    if (transcript.length > 0) {
      console.log('AudioViewer received transcript:', transcript);
      console.log('First word timing types:', {
        startTime: typeof transcript[0].startTime,
        endTime: typeof transcript[0].endTime,
        startTimeValue: transcript[0].startTime,
        endTimeValue: transcript[0].endTime
      });
    }
  }, [transcript]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressWidth = rect.width;
    const newTime = (clickX / progressWidth) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleWordClick = (idx: number) => {
    if (!selectedRange) {
      setSelectedRange({ start: idx, end: idx });
    } else if (idx < selectedRange.start) {
      setSelectedRange({ start: idx, end: selectedRange.end });
    } else if (idx > selectedRange.end) {
      setSelectedRange({ start: selectedRange.start, end: idx });
    } else {
      setSelectedRange(null);
    }
  };

  const handleAnnotate = () => {
    if (!selectedRange || !labelInput.trim()) return;
    
    const words = transcript.slice(selectedRange.start, selectedRange.end + 1);
    const newAnnotation: AudioAnnotation = {
      id: `audio-annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startTime: words[0].startTime,
      endTime: words[words.length - 1].endTime,
      label: labelInput,
      text: words.map(w => w.word).join(' '),
    };
    
    onAddAnnotation(newAnnotation);
    setSelectedRange(null);
    setLabelInput('');
    setShowAnnotationDialog(false);
  };

  const playSegment = (startTime: number, endTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
      setIsPlaying(true);
      
      // Stop at end time
      const checkTime = () => {
        if (audioRef.current && audioRef.current.currentTime >= endTime) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    }
  };

  return (
    <div className="space-y-6">
      {/* Audio Player */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          
          <div className="flex-1">
            <div
              ref={progressRef}
              className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {/* Annotation markers */}
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="absolute top-0 w-1 h-full bg-red-500 cursor-pointer"
                  style={{ left: `${(annotation.startTime / duration) * 100}%` }}
                  title={`${annotation.label}: ${annotation.text}`}
                  onClick={() => onSelectAnnotation(annotation)}
                />
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      </div>

      {/* Transcript and Annotation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
          {selectedRange && (
            <button
              onClick={() => setShowAnnotationDialog(true)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Annotate Selection
            </button>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {transcript.map((word, idx) => (
              <span
                key={idx}
                onClick={() => handleWordClick(idx)}
                className={`px-1 py-0.5 rounded cursor-pointer transition-colors text-black ${
                  selectedRange && idx >= selectedRange.start && idx <= selectedRange.end
                    ? 'bg-blue-200 text-blue-800'
                    : 'hover:bg-blue-100'
                }`}
                title={`[${Number(word.startTime || 0).toFixed(2)}s - ${Number(word.endTime || 0).toFixed(2)}s]`}
              >
                {word.word}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Annotation Details */}
      {selectedAnnotation && (
        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Annotation Details</h3>
            <button
              onClick={() => onSelectAnnotation(null)}
              className="text-gray-500 hover:text-gray-700"
              title="Close details"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <div className="p-2 bg-gray-50 rounded border text-gray-900">{selectedAnnotation.label}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annotated Text</label>
              <div className="p-2 bg-gray-50 rounded border text-gray-900">{selectedAnnotation.text}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
              <div className="p-2 bg-gray-50 rounded border text-gray-900">
                {formatTime(selectedAnnotation.startTime)} - {formatTime(selectedAnnotation.endTime)}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => playSegment(selectedAnnotation.startTime, selectedAnnotation.endTime)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
              >
                <Play className="h-3 w-3" />
                <span>Play Segment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Annotation Dialog */}
      {showAnnotationDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Add Annotation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter annotation label"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Text
                </label>
                <div className="p-2 bg-gray-50 rounded border text-sm text-gray-900">
                  {selectedRange && transcript.slice(selectedRange.start, selectedRange.end + 1).map(w => w.word).join(' ')}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAnnotationDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnnotate}
                  disabled={!labelInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Add Annotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
