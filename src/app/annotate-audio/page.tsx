"use client";

import React, { useRef, useState } from 'react';

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

interface Annotation {
  startTime: number;
  endTime: number;
  label: string;
  text: string;
}

function randomAudioId() {
  return 'audio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  // Add more as needed
];

export default function AnnotateAudioPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('en-US');
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = randomAudioId();
    setAudioId(id);
    setAudioUrl(URL.createObjectURL(file));
    // Upload and transcribe
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    const res = await fetch('/api/audio/transcribe', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) setTranscript(data.transcript);
    else alert('Transcription failed: ' + data.error);
  };

  const handleWordClick = (idx: number) => {
    if (!selectedRange) setSelectedRange({ start: idx, end: idx });
    else if (idx < selectedRange.start) setSelectedRange({ start: idx, end: selectedRange.end });
    else if (idx > selectedRange.end) setSelectedRange({ start: selectedRange.start, end: idx });
    else setSelectedRange(null);
  };

  const handleAnnotate = () => {
    if (!selectedRange) return;
    const words = transcript.slice(selectedRange.start, selectedRange.end + 1);
    setAnnotations((prev) => [
      ...prev,
      {
        startTime: words[0].startTime,
        endTime: words[words.length - 1].endTime,
        label: labelInput,
        text: words.map(w => w.word).join(' '),
      },
    ]);
    setSelectedRange(null);
    setLabelInput('');
    setShowDialog(false);
  };

  const handleSaveAnnotations = async () => {
    if (!audioId || !language || annotations.length === 0) {
      setSaveStatus('Missing audio, language, or annotations.');
      return;
    }
    setSaveStatus('Saving...');
    const res = await fetch('/api/audio/annotations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioId, language, annotations }),
    });
    const data = await res.json();
    if (data.success) setSaveStatus('Annotations saved successfully!');
    else setSaveStatus('Save failed: ' + data.error);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Audio Annotation (Transcript-Based)</h1>
      <div className="mb-4 flex gap-4 items-center">
        <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileChange} />
        <select value={language} onChange={e => setLanguage(e.target.value)} className="border rounded px-2 py-1">
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {audioId && <span className="text-xs text-gray-500">ID: {audioId}</span>}
      </div>
      {audioUrl && <audio id="audio-player" src={audioUrl} controls className="mb-4 w-full" />}
      <div className="bg-gray-50 p-4 rounded border mb-4">
        <h2 className="font-semibold mb-2">Transcript</h2>
        <div className="flex flex-wrap gap-1">
          {transcript.map((w, i) => (
            <span
              key={i}
              onClick={() => handleWordClick(i)}
              className={`px-1 py-0.5 rounded cursor-pointer ${selectedRange && i >= selectedRange.start && i <= selectedRange.end ? 'bg-blue-200' : 'hover:bg-blue-100'}`}
              title={`[${w.startTime.toFixed(2)}s - ${w.endTime.toFixed(2)}s]`}
            >
              {w.word}
            </span>
          ))}
        </div>
        {selectedRange && (
          <button className="mt-2 px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setShowDialog(true)}>
            Annotate Selection
          </button>
        )}
      </div>
      {/* Annotation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h3 className="font-semibold mb-2">Add Annotation</h3>
            <input
              type="text"
              className="w-full border px-2 py-1 rounded mb-3"
              placeholder="Label (e.g. Greeting, Question)"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleAnnotate} disabled={!labelInput.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Annotations List */}
      <div className="mt-6">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="font-semibold">Annotations</h2>
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleSaveAnnotations} disabled={!annotations.length}>Save All Annotations</button>
          {saveStatus && <span className="text-xs text-gray-700">{saveStatus}</span>}
        </div>
        {annotations.length === 0 && <div className="text-gray-500">No annotations yet.</div>}
        {annotations.map((ann, i) => (
          <div key={i} className="p-3 mb-2 bg-green-50 border border-green-200 rounded flex items-center gap-4">
            <div>
              <div className="font-medium">{ann.label}</div>
              <div className="text-sm text-gray-700">{ann.text}</div>
              <div className="text-xs text-gray-500">[{ann.startTime.toFixed(2)}s - {ann.endTime.toFixed(2)}s]</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 