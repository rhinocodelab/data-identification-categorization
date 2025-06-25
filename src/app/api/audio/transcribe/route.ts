import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { SpeechClient } from '@google-cloud/speech';

export const config = {
  api: {
    bodyParser: false,
  },
};

const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './src/config/isl.json',
});

export async function POST(req: NextRequest) {
  try {
    // Parse the form data using the Web API
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Read the file as a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine encoding from file name
    const fileName = file.name || 'audio.wav';
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'wav';

    let encoding = 'LINEAR16';
    if (fileExtension === 'mp3') encoding = 'MP3';
    else if (fileExtension === 'flac') encoding = 'FLAC';
    else if (fileExtension === 'm4a' || fileExtension === 'aac') encoding = 'AAC';
    else if (fileExtension === 'ogg') encoding = 'OGG_OPUS';

    const audioBytes = buffer.toString('base64');

    // Call Google Speech API - omit sampleRateHertz to let Google Cloud auto-detect
    const [response] = await speechClient.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: encoding as any,
        languageCode: 'en-US',
        enableWordTimeOffsets: true,
        model: 'default',
        // Remove hardcoded sampleRateHertz to let Google Cloud auto-detect from WAV header
      },
    });

    const transcript: Array<{ word: string; startTime: number; endTime: number }> = [];
    if (response.results) {
      for (const result of response.results) {
        if (result.alternatives && result.alternatives[0].words) {
          for (const wordInfo of result.alternatives[0].words) {
            const startSeconds = Number(wordInfo.startTime?.seconds || 0);
            const startNanos = Number(wordInfo.startTime?.nanos || 0);
            const endSeconds = Number(wordInfo.endTime?.seconds || 0);
            const endNanos = Number(wordInfo.endTime?.nanos || 0);
            
            const startTime = Number(startSeconds + startNanos / 1e9);
            const endTime = Number(endSeconds + endNanos / 1e9);
            
            console.log(`Word: "${wordInfo.word}", startTime: ${startTime} (type: ${typeof startTime}), endTime: ${endTime} (type: ${typeof endTime})`);
            
            transcript.push({
              word: wordInfo.word || '',
              startTime: startTime,
              endTime: endTime,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, transcript });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 