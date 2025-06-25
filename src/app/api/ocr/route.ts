import { NextRequest, NextResponse } from 'next/server';

// Initialize Google Cloud Vision client
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './src/config/isl.json',
});

interface OCRRequest {
  imagePath: string;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface TextAnnotation {
  description?: string;
  boundingPoly?: {
    vertices?: Array<{
      x?: number;
      y?: number;
    }>;
  };
  confidence?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: OCRRequest = await request.json();
    const { imagePath, boundingBox } = body;

    if (!imagePath || !boundingBox) {
      return NextResponse.json(
        { error: 'Image path and bounding box are required' },
        { status: 400 }
      );
    }

    // Construct the full image path
    const fullImagePath = `${process.cwd()}/public${imagePath}`;

    // Performs text detection on the local file
    const [result] = await client.textDetection(fullImagePath);
    const detections = result.textAnnotations || [];
    
    if (detections.length === 0) {
      return NextResponse.json({
        success: true,
        text: '',
        confidence: 0,
        message: 'No text detected in the image'
      });
    }

    // Filter text within the bounding box
    const boundingBoxTexts = detections.slice(1).filter((text: any) => {
      if (!text.boundingPoly?.vertices) return false;
      
      const vertices = text.boundingPoly.vertices;
      if (vertices.length < 4) return false;

      // Calculate the center of the detected text
      const centerX = vertices.reduce((sum: number, vertex: any) => sum + (vertex.x || 0), 0) / vertices.length;
      const centerY = vertices.reduce((sum: number, vertex: any) => sum + (vertex.y || 0), 0) / vertices.length;

      // Check if the center is within our bounding box (using rounded coordinates)
      const roundedBoundingBox = {
        x1: Math.round(boundingBox.x1),
        y1: Math.round(boundingBox.y1),
        x2: Math.round(boundingBox.x2),
        y2: Math.round(boundingBox.y2)
      };

      return (
        centerX >= roundedBoundingBox.x1 &&
        centerX <= roundedBoundingBox.x2 &&
        centerY >= roundedBoundingBox.y1 &&
        centerY <= roundedBoundingBox.y2
      );
    });

    // Extract and combine text from the bounding box
    const extractedText = boundingBoxTexts
      .map((text: any) => text.description || '')
      .join(' ')
      .trim();

    // Calculate average confidence
    const confidence = boundingBoxTexts.length > 0 
      ? boundingBoxTexts.reduce((sum: number, text: any) => sum + (text.confidence || 0), 0) / boundingBoxTexts.length
      : 0;

    return NextResponse.json({
      success: true,
      text: extractedText,
      confidence: Math.round(confidence * 100) / 100,
      message: extractedText ? 'Text extracted successfully' : 'No text found in the specified region'
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to perform OCR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 