import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { readFile } from 'fs/promises';
import path from 'path';
import { SpeechClient } from '@google-cloud/speech';
import { protos } from '@google-cloud/speech';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';

// Initialize GCP Speech-to-Text client
const speechClient = new SpeechClient({
  keyFilename: path.join(process.cwd(), 'src/config/isl.json')
});

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    console.log('Starting audio analysis for file:', fileId, '(using GCP Speech-to-Text)');
    
    // Convert string fileId to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
    
    // Get the audio file from database
    const audioFile = await db.collection('files').findOne({ _id: objectId });
    
    if (!audioFile) {
      console.log('Audio file not found in database');
      await client.close();
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    console.log('Found audio file:', audioFile.filename);

    // Get existing annotations for comparison
    const existingAnnotations = await db.collection('annotation').find({}).toArray();
    console.log('Found existing annotations:', existingAnnotations.length);

    // Get categories for mapping category IDs to names
    const categories = await db.collection('category').find({}).toArray();
    const categoryMap = new Map();
    categories.forEach(cat => {
      // Categories use 'id' field, not '_id'
      if (cat.id) {
        categoryMap.set(cat.id, cat.name);
      }
      // Also try _id as fallback for backward compatibility
      if (cat._id) {
        categoryMap.set(cat._id.toString(), cat.name);
      }
    });

    let analysisResults: {
      transcription: string;
      matchingSegments: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        source: string; 
        startTime?: number; 
        endTime?: number;
        snippet?: string;
        gcpConfidence?: number;
      }>;
      confidence: number;
      category: string;
      audioMetadata?: {
        duration: number;
        wordCount: number;
        speechRate: number;
        uniqueWords: number;
        vocabularyDiversity: number;
        pauseCount: number;
        averageWordDuration: number;
      };
    } = {
      transcription: '',
      matchingSegments: [],
      confidence: 0,
      category: 'uncategorized'
    };

    try {
      // Always use GCP Speech-to-Text for audio files
      console.log('Using GCP Speech-to-Text for transcription...');
      
      // Get the file path
      const filePath = path.join(process.cwd(), 'public', audioFile.url);
      console.log('Using audio file path:', filePath);
      
      try {
        // Check if file exists and read it
        const audioBuffer = await readFile(filePath);
        console.log('Audio file exists and is accessible, size:', audioBuffer.length, 'bytes');
        
        // Configure GCP Speech-to-Text request following the Node.js sample pattern
        const config = {
          encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
          sampleRateHertz: 48000, // Based on the audio metadata
          languageCode: 'en-US',
          enableWordTimeOffsets: true, // Get word-level timing
          enableAutomaticPunctuation: true,
        };
        
        const audio = {
          content: audioBuffer.toString('base64'),
        };
        
        const request = {
          config: config,
          audio: audio,
        };

        console.log('Sending request to GCP Speech-to-Text...');
        const [response] = await speechClient.recognize(request);
        
        if (response.results && response.results.length > 0) {
          // Extract transcript following the Node.js sample pattern
          const transcription = response.results
            .map((result: any) => result.alternatives[0].transcript)
            .join('\n');
          
          console.log('GCP Speech-to-Text completed successfully');
          console.log('Transcription:', transcription);
          
          // Extract word timings for detailed analysis
          const words: Array<{word: string, startTime: number, endTime: number}> = [];
          
          response.results.forEach((result: any) => {
            if (result.alternatives && result.alternatives[0]) {
              const alternative = result.alternatives[0];
              
              // Extract word timings
              if (alternative.words) {
                alternative.words.forEach((wordInfo: any) => {
                  const startTime = wordInfo.startTime ? parseFloat(wordInfo.startTime.seconds) + parseFloat(wordInfo.startTime.nanos) / 1e9 : 0;
                  const endTime = wordInfo.endTime ? parseFloat(wordInfo.endTime.seconds) + parseFloat(wordInfo.endTime.nanos) / 1e9 : 0;
                  
                  words.push({
                    word: wordInfo.word,
                    startTime: startTime,
                    endTime: endTime
                  });
                });
              }
            }
          });
          
          console.log('Word count:', words.length);
          
          // Create audio metadata from GCP results
          const totalDuration = words.length > 0 ? words[words.length - 1].endTime : 0;
          const uniqueWords = new Set(words.map(w => w.word.toLowerCase())).size;
          const speechRate = words.length > 0 ? words.length / (totalDuration / 60) : 0;
          
          const audioMetadata = {
            totalDuration: totalDuration,
            totalWords: words.length,
            language: 'en-US',
            sampleRate: 48000,
            channels: 1,
            fileSize: audioBuffer.length,
            fullTranscriptText: transcription,
            wordTimings: words.map(word => ({
              word: word.word,
              startTime: word.startTime,
              endTime: word.endTime,
              duration: word.endTime - word.startTime
            })),
            uniqueWords: uniqueWords,
            speechRate: speechRate,
            vocabularyDiversity: uniqueWords / words.length,
            pauseCount: 0, // Could be calculated from gaps between words
            averageWordDuration: words.length > 0 ? words.reduce((sum, word) => sum + (word.endTime - word.startTime), 0) / words.length : 0
          };
          
          analysisResults.transcription = transcription;
          analysisResults.audioMetadata = {
            duration: totalDuration,
            wordCount: words.length,
            speechRate: speechRate,
            uniqueWords: uniqueWords,
            vocabularyDiversity: uniqueWords / words.length,
            pauseCount: 0,
            averageWordDuration: words.length > 0 ? words.reduce((sum, word) => sum + (word.endTime - word.startTime), 0) / words.length : 0
          };
          
          console.log('Audio transcription completed, length:', transcription.length);
          
        } else {
          console.log('No transcription results from GCP Speech-to-Text');
          analysisResults.transcription = '';
        }
        
      } catch (gcpError) {
        console.error('GCP Speech-to-Text error:', gcpError);
        // Fallback to empty transcription if GCP fails
        analysisResults.transcription = '';
      }
      
      // Find matching segments in the transcription
      console.log('Finding matching segments...');
      const matchingSegments: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        source: string; 
        startTime?: number; 
        endTime?: number;
        snippet?: string;
        gcpConfidence?: number;
      }> = [];
      
      for (const annotationRecord of existingAnnotations) {
        // Handle the actual database structure - look for individual annotation segments
        if (annotationRecord.annotations && Array.isArray(annotationRecord.annotations)) {
          for (const annotation of annotationRecord.annotations) {
            // Check for text in audio annotations
            if (annotation.text && annotation.annotationType === 'audio_segment') {
              const annotationText = annotation.text.toLowerCase();
              const transcriptionLower = analysisResults.transcription.toLowerCase();
              
              // Check if annotation text appears in transcription
              if (transcriptionLower.includes(annotationText)) {
                console.log('Found match:', annotationText, 'in transcription');
                
                // Find the position in the original transcription
                const startIndex = analysisResults.transcription.toLowerCase().indexOf(annotationText);
                const endIndex = startIndex + annotationText.length;
                
                // Extract snippet with context
                const snippetStart = Math.max(0, startIndex - 50);
                const snippetEnd = Math.min(analysisResults.transcription.length, endIndex + 50);
                const snippet = analysisResults.transcription.substring(snippetStart, snippetEnd);
                
                // Get category name from the map
                const categoryId = annotationRecord.rule?.categoryId || 'unknown';
                const categoryName = categoryMap.get(categoryId) || categoryId;
                
                matchingSegments.push({
                  text: annotation.text,
                  category: categoryName,
                  confidence: 0.95, // High confidence for exact matches
                  source: 'GCP Speech-to-Text',
                  snippet: snippet,
                  gcpConfidence: 0.95,
                  startTime: annotation.startTime,
                  endTime: annotation.endTime
                });
                
                console.log('Found audio segment match:', annotation.text, 'in transcription');
              }
            }
            
            // Also check for keyword text in other annotation types that might be relevant
            if (annotation.keywordText) {
              const annotationText = annotation.keywordText.toLowerCase();
              const transcriptionLower = analysisResults.transcription.toLowerCase();
              
              // Check if annotation text appears in transcription
              if (transcriptionLower.includes(annotationText)) {
                console.log('Found keyword match:', annotationText, 'in transcription');
                
                // Find the position in the original transcription
                const startIndex = analysisResults.transcription.toLowerCase().indexOf(annotationText);
                const endIndex = startIndex + annotationText.length;
                
                // Extract snippet with context
                const snippetStart = Math.max(0, startIndex - 50);
                const snippetEnd = Math.min(analysisResults.transcription.length, endIndex + 50);
                const snippet = analysisResults.transcription.substring(snippetStart, snippetEnd);
                
                // Get category name from the map
                const categoryId = annotationRecord.rule?.categoryId || 'unknown';
                const categoryName = categoryMap.get(categoryId) || categoryId;
                
                matchingSegments.push({
                  text: annotation.keywordText,
                  category: categoryName,
                  confidence: 0.9, // High confidence for keyword matches
                  source: 'GCP Speech-to-Text',
                  snippet: snippet,
                  gcpConfidence: 0.9
                });
                
                console.log('Found keyword match:', annotation.keywordText, 'in transcription');
              }
            }
          }
        }
      }
      
      analysisResults.matchingSegments = matchingSegments;
      console.log('Found matching segments:', matchingSegments.length);
      
      // Calculate overall confidence and determine category
      if (matchingSegments.length > 0) {
        const avgConfidence = matchingSegments.reduce((sum, segment) => sum + segment.confidence, 0) / matchingSegments.length;
        analysisResults.confidence = avgConfidence;
        
        // Use the category of the first match (could be improved with voting)
        analysisResults.category = matchingSegments[0].category;
      } else {
        analysisResults.confidence = 0;
        analysisResults.category = 'uncategorized';
      }
      
      console.log('Final analysis results:', {
        category: analysisResults.category,
        confidence: analysisResults.confidence,
        matchingSegmentsCount: analysisResults.matchingSegments.length,
        transcriptionLength: analysisResults.transcription.length,
        audioMetadata: analysisResults.audioMetadata
      });
      
    } catch (error) {
      console.error('Audio analysis error:', error);
      analysisResults.category = 'uncategorized';
      analysisResults.confidence = 0;
    }
    
    await client.close();
    
    console.log('Audio analysis completed successfully');
    
    return NextResponse.json({
      success: true,
      category: analysisResults.category,
      confidence: analysisResults.confidence,
      score: analysisResults.confidence,
      analysisResults: analysisResults,
      destPath: `/category/${analysisResults.category.toLowerCase().replace(/\s+/g, '-')}`
    });
    
  } catch (error) {
    console.error('Audio auto-categorize error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process audio file',
      category: 'uncategorized',
      confidence: 0,
      score: 0
    }, { status: 500 });
  }
} 