'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioCategorizePlayerProps {
  audioUrl: string;
  transcript?: Array<{ word: string; startTime: number; endTime: number }>;
  matchingSegments?: Array<{ startTime: number; endTime: number; text: string; label: string }>;
  fullTranscriptText?: string;
}

export default function AudioCategorizePlayer({ 
  audioUrl, 
  transcript = [], 
  matchingSegments = [],
  fullTranscriptText = ''
}: AudioCategorizePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    // Debug audio URL
    console.log('AudioCategorizePlayer - Audio URL:', audioUrl);
    console.log('AudioCategorizePlayer - Audio URL type:', typeof audioUrl);
    console.log('AudioCategorizePlayer - Audio URL length:', audioUrl?.length);

    // Test if the audio file exists - only if we have a valid URL
    if (audioUrl && audioUrl.trim() !== '') {
      // Validate URL format
      try {
        const url = new URL(audioUrl, window.location.origin);
        console.log('AudioCategorizePlayer - Validated URL:', url.href);
      } catch (urlError) {
        console.error('AudioCategorizePlayer - Invalid URL format:', audioUrl, urlError);
        setAudioError(`Invalid audio URL format: ${audioUrl}`);
        return;
      }

      // Test if the file is accessible via fetch first
      fetch(audioUrl, { method: 'HEAD' })
        .then(response => {
          console.log('AudioCategorizePlayer - Fetch test response:', response.status, response.statusText);
          console.log('AudioCategorizePlayer - Content-Type:', response.headers.get('content-type'));
          console.log('AudioCategorizePlayer - Content-Length:', response.headers.get('content-length'));
          
          if (!response.ok) {
            setAudioError(`Audio file not accessible: ${response.status} ${response.statusText}`);
            return;
          }
          
          // If fetch succeeds, try loading with audio element
          const testAudio = new Audio();
          testAudio.preload = 'metadata';
          
          testAudio.onloadstart = () => {
            console.log('AudioCategorizePlayer - Audio file loading started for URL:', audioUrl);
            setAudioError(null);
          };
          
          testAudio.oncanplay = () => {
            console.log('AudioCategorizePlayer - Audio file can play:', audioUrl);
            setAudioError(null);
          };
          
          testAudio.onerror = (e: string | Event) => {
            console.error('AudioCategorizePlayer - Audio file test error:', e);
            if (typeof e === 'string') {
              setAudioError(`Audio file error: ${e}`);
            } else {
              const target = e.target as HTMLAudioElement;
              console.error('AudioCategorizePlayer - Audio element error details:', {
                error: target.error,
                readyState: target.readyState,
                networkState: target.networkState,
                src: target.src
              });
              const errorMessage = target.error?.message || 'Audio file not accessible';
              setAudioError(`Audio file error: ${errorMessage}`);
            }
          };
          
          testAudio.src = audioUrl;
        })
        .catch(fetchError => {
          console.error('AudioCategorizePlayer - Fetch test failed:', fetchError);
          setAudioError(`Audio file fetch failed: ${fetchError.message}`);
        });
      
      // Cleanup function for the test audio
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
      };
    } else {
      console.warn('AudioCategorizePlayer - No audio URL provided or empty URL');
      setAudioError('No audio URL provided');
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

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

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentSegment = () => {
    return matchingSegments.find(segment => 
      currentTime >= segment.startTime && currentTime <= segment.endTime
    );
  };

  const currentSegment = getCurrentSegment();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
        <Volume2 className="h-5 w-5 mr-2 text-blue-600" />
        Audio Analysis & Playback
      </h3>

      {/* Audio Player */}
      <div className="mb-6">
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="metadata"
          onError={(e) => {
            console.error('AudioCategorizePlayer - Main audio loading error event:', e);
            console.error('AudioCategorizePlayer - Audio URL:', audioUrl);
            const target = e.target as HTMLAudioElement;
            console.error('AudioCategorizePlayer - Audio element error:', target.error);
            console.error('AudioCategorizePlayer - Audio element readyState:', target.readyState);
            console.error('AudioCategorizePlayer - Audio element networkState:', target.networkState);
            console.error('AudioCategorizePlayer - Audio element src:', target.src);
            
            // Get more detailed error information
            let errorMessage = 'Unknown error';
            if (target.error) {
              console.error('AudioCategorizePlayer - MediaError code:', target.error.code);
              console.error('AudioCategorizePlayer - MediaError message:', target.error.message);
              
              switch (target.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                  errorMessage = 'Audio loading was aborted';
                  break;
                case MediaError.MEDIA_ERR_NETWORK:
                  errorMessage = 'Network error while loading audio';
                  break;
                case MediaError.MEDIA_ERR_DECODE:
                  errorMessage = 'Audio decoding error';
                  break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = 'Audio format not supported';
                  break;
                default:
                  errorMessage = target.error.message || 'Unknown media error';
              }
            } else {
              // Check network state for additional clues
              console.error('AudioCategorizePlayer - No MediaError, checking network state');
              switch (target.networkState) {
                case HTMLMediaElement.NETWORK_EMPTY:
                  errorMessage = 'Audio not loaded';
                  break;
                case HTMLMediaElement.NETWORK_IDLE:
                  errorMessage = 'Audio loaded but idle';
                  break;
                case HTMLMediaElement.NETWORK_LOADING:
                  errorMessage = 'Audio is loading';
                  break;
                case HTMLMediaElement.NETWORK_NO_SOURCE:
                  errorMessage = 'No audio source available';
                  break;
                default:
                  errorMessage = 'Audio loading failed';
              }
            }
            
            setAudioError(`Audio loading failed: ${errorMessage}`);
          }}
          onLoadStart={() => {
            console.log('AudioCategorizePlayer - Main audio loading started for URL:', audioUrl);
            setAudioError(null);
          }}
          onCanPlay={() => {
            console.log('AudioCategorizePlayer - Main audio can play:', audioUrl);
            setAudioError(null);
          }}
        />
        
        {/* Error display */}
        {audioError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800 font-medium mb-1">Audio Loading Error</div>
            <div className="text-xs text-red-700">{audioError}</div>
            <div className="text-xs text-red-600 mt-1">URL: {audioUrl}</div>
          </div>
        )}
        
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={togglePlay}
            disabled={!!audioError}
            className={`p-2 rounded-full transition-colors ${
              audioError 
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          
          <span className="text-sm text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        {/* Debug info */}
        <div className="text-xs text-gray-500 mb-2">
          Audio URL: {audioUrl}
        </div>
      </div>

      {/* Current Segment */}
      {currentSegment && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-1">
            Currently Playing: {currentSegment.label}
          </div>
          <div className="text-sm text-blue-800">
            "{currentSegment.text}" ({currentSegment.startTime.toFixed(1)}s - {currentSegment.endTime.toFixed(1)}s)
          </div>
        </div>
      )}

      {/* Matching Segments */}
      {matchingSegments.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Matching Segments</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {matchingSegments.map((segment, index) => (
              <div
                key={index}
                className="p-2 rounded border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = segment.startTime;
                    setCurrentTime(segment.startTime);
                  }
                }}
              >
                <div className="text-xs text-gray-600 mb-1">
                  {segment.label} ({segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s)
                </div>
                <div className="text-sm text-gray-800">
                  "{segment.text}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Transcript */}
      {fullTranscriptText && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Full Transcript</h4>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
            <p className="text-sm text-gray-700 leading-relaxed">
              {fullTranscriptText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 