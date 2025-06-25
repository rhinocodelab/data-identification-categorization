import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string - you'll need to set this in your environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const COLLECTION_NAME = 'annotation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule, annotations, dataId, dataURL, dataDimensions, fileType, transcript, audioMetadata } = body;

    console.log('Received rule data:', rule);
    console.log('Rule categoryId:', rule?.categoryId);
    console.log('Received annotations:', annotations);
    console.log('DataId:', dataId);
    console.log('File type:', fileType);
    console.log('Has transcript:', !!transcript);
    console.log('Has audio metadata:', !!audioMetadata);

    // Validate required fields
    if (!rule || !annotations || !dataId) {
      return NextResponse.json(
        { error: 'Missing required fields: rule, annotations, or dataId' },
        { status: 400 }
      );
    }

    // Determine file type - use explicit fileType or fallback to URL-based detection
    let detectedFileType = fileType;
    if (!detectedFileType) {
      if (dataURL?.includes('pdfs')) {
        detectedFileType = 'pdf';
      } else if (dataURL?.includes('jsons') || dataId?.toLowerCase().endsWith('.json')) {
        detectedFileType = 'json';
      } else if (dataURL?.includes('audio') || dataId?.toLowerCase().match(/\.(wav|mp3|flac|m4a|aac|ogg)$/)) {
        detectedFileType = 'audio';
      } else {
        detectedFileType = 'image';
      }
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    try {
      await client.connect();
      console.log('Connected to MongoDB successfully');
    } catch (connectionError) {
      console.error('MongoDB connection error:', connectionError);
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 500 }
      );
    }

    const database = client.db(DATABASE_NAME);
    const collection = database.collection(COLLECTION_NAME);

    // Prepare the document to save
    let annotationDocument: any = {
      rule: {
        id: rule.id,
        ruleName: rule.ruleName,
        categoryId: rule.categoryId || null
      },
      dataId: dataId,
      dataURL: dataURL || null,
      dataDimensions: dataDimensions || null,
      type: detectedFileType,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle different file types
    if (detectedFileType === 'audio') {
      // For audio files, preserve all the rich metadata
      annotationDocument.annotations = annotations.map((annotation: any) => ({
        id: annotation.id,
        ruleId: annotation.ruleId,
        // Audio-specific fields
        startTime: annotation.startTime,
        endTime: annotation.endTime,
        label: annotation.label,
        text: annotation.text,
        annotationType: annotation.annotationType || 'audio_segment',
        // Preserve all metadata for auto-categorization
        metadata: annotation.metadata || {
          startTime: annotation.startTime,
          endTime: annotation.endTime,
          duration: annotation.endTime - annotation.startTime,
          label: annotation.label,
          text: annotation.text,
          wordCount: annotation.text?.split(' ').length || 0
        }
      }));

      // Add audio-specific data
      if (transcript) {
        annotationDocument.transcript = transcript;
      }
      if (audioMetadata) {
        annotationDocument.audioMetadata = audioMetadata;
      }
    } else {
      // For other file types (image, PDF, JSON)
      annotationDocument.annotations = annotations.map((annotation: any) => ({
        id: annotation.id,
        ruleId: annotation.ruleId,
        x1: annotation.annotationType === 'json' ? null : Math.round(annotation.x1),
        y1: annotation.annotationType === 'json' ? null : Math.round(annotation.y1),
        x2: annotation.annotationType === 'json' ? null : Math.round(annotation.x2),
        y2: annotation.annotationType === 'json' ? null : Math.round(annotation.y2),
        label: annotation.label,
        ocrText: annotation.ocrText || null,
        ocrConfidence: annotation.ocrConfidence || null,
        // PDF-specific fields
        pageNumber: annotation.pageNumber || null,
        keywordText: annotation.keywordText || null,
        // JSON-specific fields
        jsonKey: annotation.jsonKey || null,
        jsonValue: annotation.jsonValue || null,
        annotationType: annotation.annotationType || 'image'
      }));
    }

    console.log('Prepared annotation document:', annotationDocument);

    try {
      // Check if a document with this dataId already exists
      const existingDocument = await collection.findOne({ dataId: dataId });

      if (existingDocument) {
        // Update existing document
        console.log('Updating existing document for dataId:', dataId);
        await collection.updateOne(
          { dataId: dataId },
          { 
            $set: {
              ...annotationDocument,
              updatedAt: new Date()
            }
          }
        );
      } else {
        // Insert new document
        console.log('Inserting new document for dataId:', dataId);
        await collection.insertOne(annotationDocument);
      }

      await client.close();
      console.log('Database operation completed successfully');

      return NextResponse.json({ 
        success: true, 
        message: existingDocument ? 'Annotation data updated successfully' : 'Annotation data saved successfully',
        dataId: dataId
      });

    } catch (dbError) {
      console.error('Database operation error:', dbError);
      await client.close();
      return NextResponse.json(
        { error: 'Failed to save annotation data to database' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error saving annotation data:', error);
    return NextResponse.json(
      { error: 'Failed to save annotation data' },
      { status: 500 }
    );
  }
} 