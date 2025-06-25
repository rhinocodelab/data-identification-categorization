import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { mkdir, rename, stat, copyFile, unlink, readFile } from 'fs/promises';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const ANNOTATION_COLLECTION = 'annotation';
const CATEGORY_COLLECTION = 'category';
const AUTO_CATEGORIZED_ROOT = path.join(process.cwd(), 'public', 'auto-categorized');

// Google Cloud Vision API configuration
const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const GOOGLE_CLOUD_PRIVATE_KEY = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLOUD_CLIENT_EMAIL = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Helper function to calculate text similarity (simple implementation)
function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1.0;
  
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
}

// Helper function to calculate bounding box similarity
function calculateBoundingBoxSimilarity(bbox1: { x1: number, y1: number, x2: number, y2: number }, 
                                       bbox2: { x1: number, y1: number, x2: number, y2: number }): number {
  // Calculate overlap area
  const xOverlap = Math.max(0, Math.min(bbox1.x2, bbox2.x2) - Math.max(bbox1.x1, bbox2.x1));
  const yOverlap = Math.max(0, Math.min(bbox1.y2, bbox2.y2) - Math.max(bbox1.y1, bbox2.y1));
  const overlapArea = xOverlap * yOverlap;
  
  // Calculate areas
  const area1 = (bbox1.x2 - bbox1.x1) * (bbox1.y2 - bbox1.y1);
  const area2 = (bbox2.x2 - bbox2.x1) * (bbox2.y2 - bbox2.y1);
  const unionArea = area1 + area2 - overlapArea;
  
  return unionArea > 0 ? overlapArea / unionArea : 0;
}

// Helper: check if two bounding boxes overlap
function doBoundingBoxesOverlap(
  b1: { x1: number; y1: number; x2: number; y2: number },
  b2: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  return (
    b1.x1 < b2.x2 && b1.x2 > b2.x1 &&
    b1.y1 < b2.y2 && b1.y2 > b2.y1
  );
}

// Helper: convert GCP boundingPoly vertices to {x1, y1, x2, y2}
function polyToBox(vertices: { x: number; y: number }[]): { x1: number; y1: number; x2: number; y2: number } {
  const xs = vertices.map((v: { x: number; y: number }) => v.x);
  const ys = vertices.map((v: { x: number; y: number }) => v.y);
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys)
  };
}

// Helper function to call Google Cloud Vision API for OCR
async function performOCRWithGCP(imagePath: string, boundingBox?: { x1: number, y1: number, x2: number, y2: number }): Promise<string> {
  try {
    // Check if service account credentials are available
    if (!GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Google Cloud service account credentials not configured, using fallback OCR simulation');
      // For testing purposes, return a simulated OCR result based on the bounding box
      if (boundingBox) {
        const area = (boundingBox.x2 - boundingBox.x1) * (boundingBox.y2 - boundingBox.y1);
        if (area > 1000) {
          return 'simulated ocr text';
        } else {
          return '';
        }
      }
      return '';
    }

    console.log('GCP credentials path:', GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Processing image with bounding box:', boundingBox);

    // Read the image file
    const imageBuffer = await readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`Processing image: ${imagePath} (${imageBuffer.length} bytes)`);

    // Read service account credentials
    const credentialsPath = path.resolve(GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Reading credentials from:', credentialsPath);
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    console.log('Credentials loaded successfully, client_email:', credentials.client_email);

    // Prepare the request payload for TEXT_DETECTION
    const requestBody: any = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 10
        }]
      }]
    };

    console.log('Calling Google Cloud Vision API TEXT_DETECTION with service account authentication');

    // Call Google Cloud Vision API using service account
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAccessToken(credentials)}`
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GCP Vision API error response:', errorText);
      throw new Error(`GCP Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('GCP Vision API response received successfully');
    
    // Extract text from the response
    if (result.responses && result.responses[0]) {
      const response = result.responses[0];
      if (response.textAnnotations && response.textAnnotations.length > 0) {
        // If no bounding box, return the full text
        if (!boundingBox) {
          const fullText = response.textAnnotations[0].description || '';
          console.log(`TEXT_DETECTION extracted text: "${fullText}"`);
          return fullText;
        }
        // Otherwise, filter textAnnotations by overlap with boundingBox
        const regionTexts = response.textAnnotations.slice(1) // skip the first, which is the full text
          .filter((ann: any) => ann.boundingPoly && doBoundingBoxesOverlap(boundingBox, polyToBox(ann.boundingPoly.vertices)))
          .map((ann: any) => ann.description);
        const regionText = regionTexts.join(' ').trim();
        console.log(`TEXT_DETECTION region text: "${regionText}"`);
        return regionText;
      }
      if (response.error) {
        console.error('GCP Vision API returned error:', response.error);
        throw new Error(`GCP Vision API error: ${response.error.message || 'Unknown error'}`);
      }
      console.log('No text detected in the image');
      return '';
    }
    console.log('No response data from GCP Vision API');
    return '';
  } catch (error) {
    console.error('GCP Vision API error:', error);
    throw error;
  }
}

// Helper function to get access token from service account
async function getAccessToken(credentials: any): Promise<string> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: createJWT(credentials),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Helper function to create JWT for service account
function createJWT(credentials: any): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${encodedHeader}.${encodedPayload}`);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Helper to extract all text from a PDF file
async function extractPdfText(pdfPath: string): Promise<string> {
  const dataBuffer = await readFile(pdfPath);
  const pdfParse = (await import('pdf-parse-v2')).default;
  const data = await pdfParse(dataBuffer);
  return data.text;
}

// Helper to extract text per page from a PDF file
async function extractPdfPages(pdfPath: string): Promise<string[]> {
  try {
    console.log('Attempting to extract PDF text from:', pdfPath);
    const dataBuffer = await readFile(pdfPath);
    console.log('PDF file read successfully, size:', dataBuffer.length);
    
    const pdfParse = (await import('pdf-parse-v2')).default;
    const data = await pdfParse(dataBuffer);
    console.log('PDF parsed successfully, text length:', data.text?.length || 0);
    
    // Split by form feed (\f) which pdf-parse uses for page breaks
    const pages = data.text.split('\f').map((page: string) => page.trim());
    console.log('PDF split into pages:', pages.length);
    
    return pages;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract PDF text: ${errorMessage}`);
  }
}

// Helper to extract key-value pairs from a JSON file
async function extractJsonKeyValues(jsonPath: string): Promise<{ [key: string]: any }> {
  try {
    console.log('Attempting to extract JSON key-value pairs from:', jsonPath);
    const dataBuffer = await readFile(jsonPath, 'utf8');
    console.log('JSON file read successfully, size:', dataBuffer.length);
    
    const jsonData = JSON.parse(dataBuffer);
    console.log('JSON parsed successfully');
    
    // Flatten nested objects to get all key-value pairs
    const flattened: { [key: string]: any } = {};
    
    function flattenObject(obj: any, prefix: string = '') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], newKey);
          } else {
            flattened[newKey] = obj[key];
          }
        }
      }
    }
    
    flattenObject(jsonData);
    console.log('JSON flattened, found keys:', Object.keys(flattened));
    
    return flattened;
  } catch (error) {
    console.error('Error extracting JSON key-value pairs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract JSON key-value pairs: ${errorMessage}`);
  }
}

// Helper function to calculate visual similarity between images
async function calculateVisualSimilarity(imagePath1: string, imagePath2: string, bbox1?: { x1: number, y1: number, x2: number, y2: number }, bbox2?: { x1: number, y1: number, x2: number, y2: number }): Promise<number> {
  try {
    // For now, we'll implement a simple approach using image dimensions and basic features
    // In a production system, you'd want to use more sophisticated image similarity algorithms
    
    const { createCanvas, loadImage } = await import('canvas');
    
    // Load both images
    const img1 = await loadImage(imagePath1);
    const img2 = await loadImage(imagePath2);
    
    // Create canvases to analyze images
    const canvas1 = createCanvas(img1.width, img1.height);
    const canvas2 = createCanvas(img2.width, img2.height);
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    
    // Draw images to canvases
    ctx1.drawImage(img1, 0, 0);
    ctx2.drawImage(img2, 0, 0);
    
    // Extract bounded regions if bounding boxes are provided
    let region1, region2;
    
    if (bbox1) {
      // Crop the first image to the bounding box region
      const width1 = bbox1.x2 - bbox1.x1;
      const height1 = bbox1.y2 - bbox1.y1;
      region1 = ctx1.getImageData(bbox1.x1, bbox1.y1, width1, height1);
      console.log(`Extracted region 1: ${width1}x${height1} at (${bbox1.x1}, ${bbox1.y1})`);
    } else {
      // Use entire image if no bounding box
      region1 = ctx1.getImageData(0, 0, img1.width, img1.height);
      console.log(`Using entire image 1: ${img1.width}x${img1.height}`);
    }
    
    if (bbox2) {
      // Crop the second image to the bounding box region
      const width2 = bbox2.x2 - bbox2.x1;
      const height2 = bbox2.y2 - bbox2.y1;
      region2 = ctx2.getImageData(bbox2.x1, bbox2.y1, width2, height2);
      console.log(`Extracted region 2: ${width2}x${height2} at (${bbox2.x1}, ${bbox2.y1})`);
    } else {
      // Use entire image if no bounding box
      region2 = ctx2.getImageData(0, 0, img2.width, img2.height);
      console.log(`Using entire image 2: ${img2.width}x${img2.height}`);
    }
    
    // Calculate basic visual similarity metrics for the bounded regions
    let similarity = 0;
    
    // 1. Aspect ratio similarity
    const aspectRatio1 = region1.width / region1.height;
    const aspectRatio2 = region2.width / region2.height;
    const aspectRatioDiff = Math.abs(aspectRatio1 - aspectRatio2);
    const aspectRatioSimilarity = Math.max(0, 1 - aspectRatioDiff);
    
    // 2. Size similarity (normalized)
    const size1 = region1.width * region1.height;
    const size2 = region2.width * region2.height;
    const sizeSimilarity = Math.min(size1, size2) / Math.max(size1, size2);
    
    // 3. Color histogram similarity (simplified)
    const colorSimilarity = calculateColorSimilarity(region1, region2);
    
    // Combine metrics (weighted average)
    similarity = (aspectRatioSimilarity * 0.3 + sizeSimilarity * 0.3 + colorSimilarity * 0.4);
    
    console.log(`Visual similarity calculation (bounded regions): aspect=${aspectRatioSimilarity.toFixed(3)}, size=${sizeSimilarity.toFixed(3)}, color=${colorSimilarity.toFixed(3)}, total=${similarity.toFixed(3)}`);
    
    return similarity;
  } catch (error) {
    console.error('Error calculating visual similarity:', error);
    return 0;
  }
}

// Helper function to calculate color similarity between two images
function calculateColorSimilarity(data1: any, data2: any): number {
  try {
    // Create color histograms (simplified - just count RGB values)
    const histogram1 = new Array(256).fill(0);
    const histogram2 = new Array(256).fill(0);
    
    // Sample pixels for efficiency (every 10th pixel)
    for (let i = 0; i < data1.data.length; i += 40) {
      const r = data1.data[i];
      const g = data1.data[i + 1];
      const b = data1.data[i + 2];
      const gray = Math.round((r + g + b) / 3);
      histogram1[gray]++;
    }
    
    for (let i = 0; i < data2.data.length; i += 40) {
      const r = data2.data[i];
      const g = data2.data[i + 1];
      const b = data2.data[i + 2];
      const gray = Math.round((r + g + b) / 3);
      histogram2[gray]++;
    }
    
    // Normalize histograms
    const sum1 = histogram1.reduce((a, b) => a + b, 0);
    const sum2 = histogram2.reduce((a, b) => a + b, 0);
    
    if (sum1 === 0 || sum2 === 0) return 0;
    
    const normalized1 = histogram1.map(h => h / sum1);
    const normalized2 = histogram2.map(h => h / sum2);
    
    // Calculate histogram intersection
    let intersection = 0;
    for (let i = 0; i < 256; i++) {
      intersection += Math.min(normalized1[i], normalized2[i]);
    }
    
    return intersection;
  } catch (error) {
    console.error('Error calculating color similarity:', error);
    return 0;
  }
}

// Helper function to extract visual features from an image
async function extractVisualFeatures(imagePath: string): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
  dominantColors: number[];
  brightness: number;
}> {
  try {
    const { createCanvas, loadImage } = await import('canvas');
    
    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    
    // Calculate basic features
    const aspectRatio = img.width / img.height;
    const brightness = calculateAverageBrightness(data);
    const dominantColors = extractDominantColors(data);
    
    return {
      width: img.width,
      height: img.height,
      aspectRatio,
      dominantColors,
      brightness
    };
  } catch (error) {
    console.error('Error extracting visual features:', error);
    return {
      width: 0,
      height: 0,
      aspectRatio: 0,
      dominantColors: [],
      brightness: 0
    };
  }
}

// Helper function to calculate average brightness
function calculateAverageBrightness(data: any): number {
  let total = 0;
  let count = 0;
  
  for (let i = 0; i < data.data.length; i += 40) { // Sample every 10th pixel
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    total += (r + g + b) / 3;
    count++;
  }
  
  return count > 0 ? total / count : 0;
}

// Helper function to extract dominant colors
function extractDominantColors(data: any): number[] {
  const colorCounts = new Map<string, number>();
  
  for (let i = 0; i < data.data.length; i += 40) { // Sample every 10th pixel
    const r = Math.floor(data.data[i] / 32) * 32; // Quantize to 8 levels
    const g = Math.floor(data.data[i + 1] / 32) * 32;
    const b = Math.floor(data.data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }
  
  // Get top 3 dominant colors
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([color]) => color.split(',').map(Number));
  
  return sortedColors.flat();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataId, filePath } = body;
    
    console.log('Auto-categorize request body:', body);
    
    // Handle uploaded file case (from auto-categorize upload page)
    if (filePath) {
      console.log('Auto-categorizing uploaded file:', filePath);
      console.log('Full filePath:', filePath);
      console.log('filePath type:', typeof filePath);
      
      // This is for the auto-categorize upload flow
      // Extract filename from path
      const fileName = filePath.split('/').pop() || 'unknown';
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      console.log('Extracted fileName:', fileName);
      console.log('Extracted fileExtension:', fileExtension);
      console.log('fileName length:', fileName.length);
      console.log('fileName characters:', fileName.split('').map((c: string) => c.charCodeAt(0)));
      
      // Simple categorization based on file type and content
      let category = 'un-identified data';
      let score = 0.3;
      let destPath = '';
      
      if (fileExtension === 'wav' || fileExtension === 'mp3' || fileExtension === 'flac') {
        // For audio files, we could do more sophisticated analysis
        // For now, categorize as "Audio" if it's an audio file
        category = 'Audio';
        score = 0.8;
        destPath = path.join(AUTO_CATEGORIZED_ROOT, 'audio', fileName);
        
        // Try to transcribe the audio file for better categorization
        try {
          const sourcePath = path.join(process.cwd(), 'public', filePath);
          console.log('Attempting to transcribe audio file:', sourcePath);
          
          // Import the transcription function (you may need to adjust the path)
          const { transcribeAudioFile } = await import('../../../utils/audioTranscription');
          const transcriptionResult = await transcribeAudioFile(sourcePath);
          
          if (transcriptionResult.success && transcriptionResult.transcript) {
            const transcript = transcriptionResult.transcript;
            const fullTranscriptText = transcript.map((word: any) => word.word).join(' ');
            
            // Find matching segments based on keywords
            const matchingSegments = [];
            const keywords = ['train', 'platform', 'arriving', 'late', 'meeting', 'conference', 'business'];
            
            for (const word of transcript) {
              if (keywords.some(keyword => word.word.toLowerCase().includes(keyword))) {
                matchingSegments.push({
                  startTime: word.startTime,
                  endTime: word.endTime,
                  text: word.word,
                  label: 'Keyword Match'
                });
              }
            }
            
            const responseDestPath = destPath.replace(process.cwd(), '');
            console.log('Returning destPath:', responseDestPath);
            console.log('Original destPath:', destPath);
            console.log('process.cwd():', process.cwd());
            
            return NextResponse.json({
              success: true,
              category,
              score,
              destPath: responseDestPath,
              threshold: 0.3,
              transcript,
              matchingSegments,
              fullTranscriptText
            });
          }
        } catch (transcriptionError) {
          console.log('Transcription failed, proceeding with basic categorization:', transcriptionError);
        }
      } else if (fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg') {
        category = 'Images';
        score = 0.9;
        destPath = path.join(AUTO_CATEGORIZED_ROOT, 'images', fileName);
      } else if (fileExtension === 'pdf') {
        category = 'Documents';
        score = 0.85;
        destPath = path.join(AUTO_CATEGORIZED_ROOT, 'documents', fileName);
      } else if (fileExtension === 'json') {
        category = 'Data';
        score = 0.9;
        destPath = path.join(AUTO_CATEGORIZED_ROOT, 'data', fileName);
      }
      
      // Create destination directory if it doesn't exist
      const destDir = path.dirname(destPath);
      await mkdir(destDir, { recursive: true });
      
      // Move file to categorized location
      const sourcePath = path.join(process.cwd(), 'public', filePath);
      await rename(sourcePath, destPath);
      
      return NextResponse.json({
        success: true,
        category,
        score,
        destPath: destPath.replace(process.cwd(), ''),
        threshold: 0.3
      });
    }
    
    // Handle saved annotation case (from annotation page)
    if (dataId) {
      console.log('Auto-categorizing saved annotation for dataId:', dataId);
      
      // Connect to MongoDB and fetch annotation document
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db(DATABASE_NAME);
      const collection = db.collection(ANNOTATION_COLLECTION);
      const doc = await collection.findOne({ dataId });
      await client.close();

      if (!doc) {
        return NextResponse.json({ error: 'No annotation data found for this audio file' }, { status: 404 });
      }

      // --- Auto-categorization logic ---
      // Example: simple keyword-based categorization
      const transcriptText = doc.audioMetadata?.fullTranscriptText?.toLowerCase() || '';
      let categoryId = null;
      let categoryName = null;
      let confidence = 0.0;
      let reason = '';

      if (transcriptText.includes('train') || transcriptText.includes('platform')) {
        categoryId = 'transport';
        categoryName = 'Transport';
        confidence = 0.95;
        reason = 'Keywords "train" or "platform" found in transcript.';
      } else if (transcriptText.includes('meeting') || transcriptText.includes('conference')) {
        categoryId = 'business';
        categoryName = 'Business';
        confidence = 0.9;
        reason = 'Keywords "meeting" or "conference" found in transcript.';
      } else {
        categoryId = 'general';
        categoryName = 'General';
        confidence = 0.5;
        reason = 'No strong keyword match found.';
      }

      return NextResponse.json({
        success: true,
        categoryId,
        categoryName,
        confidence,
        reason
      });
    }
    
    // Neither dataId nor filePath provided
    return NextResponse.json({ error: 'Missing dataId or filePath' }, { status: 400 });
    
  } catch (error) {
    console.error('Auto-categorize error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 