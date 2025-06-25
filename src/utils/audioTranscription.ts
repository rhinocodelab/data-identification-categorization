import { SpeechClient } from '@google-cloud/speech';
import { readFile } from 'fs/promises';

const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './src/config/isl.json',
});

export async function transcribeAudioFile(filePath: string): Promise<{
  success: boolean;
  transcript?: Array<{ word: string; startTime: number; endTime: number }>;
  error?: string;
}> {
  try {
    // Read the audio file
    const audioBuffer = await readFile(filePath);
    const audioBytes = audioBuffer.toString('base64');

    // Determine encoding from file extension
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || 'wav';
    let encoding = 'LINEAR16';
    if (fileExtension === 'mp3') encoding = 'MP3';
    else if (fileExtension === 'flac') encoding = 'FLAC';
    else if (fileExtension === 'm4a' || fileExtension === 'aac') encoding = 'AAC';
    else if (fileExtension === 'ogg') encoding = 'OGG_OPUS';

    // Call Google Speech API
    const [response] = await speechClient.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: encoding as any,
        languageCode: 'en-US',
        enableWordTimeOffsets: true,
        model: 'default',
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
            
            transcript.push({
              word: wordInfo.word || '',
              startTime: startTime,
              endTime: endTime,
            });
          }
        }
      }
    }

    return { success: true, transcript };
  } catch (error) {
    console.error('Transcription error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 