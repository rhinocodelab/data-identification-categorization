import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const COLLECTION_NAME = 'annotation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataId: string }> }
) {
  try {
    const { dataId } = await params;

    if (!dataId) {
      return NextResponse.json(
        { error: 'Data ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const database = client.db(DATABASE_NAME);
    const collection = database.collection(COLLECTION_NAME);

    // Debug: Print all dataIds in the collection
    const allDocs = await collection.find({}).toArray();
    console.log('All annotation docs dataIds:', allDocs.map(d => d.dataId));
    console.log('Looking for dataId:', dataId);

    // Find the annotation document for this dataId
    const annotationData = await collection.findOne({ dataId: dataId });

    await client.close();

    if (!annotationData) {
      console.log('No annotation data found for file:', dataId);
      return NextResponse.json(
        { message: 'No annotation data found for this data file' },
        { status: 404 }
      );
    }

    // Return the annotation data
    return NextResponse.json({
      success: true,
      data: {
        rule: annotationData.rule,
        annotations: annotationData.annotations,
        dataId: annotationData.dataId,
        dataURL: annotationData.dataURL,
        dataDimensions: annotationData.dataDimensions,
        type: annotationData.type,
        createdAt: annotationData.createdAt,
        updatedAt: annotationData.updatedAt,
        // Audio-specific data
        transcript: annotationData.transcript || null,
        audioMetadata: annotationData.audioMetadata || null
      }
    });

  } catch (error) {
    console.error('Error loading annotation data:', error);
    return NextResponse.json(
      { error: 'Failed to load annotation data' },
      { status: 500 }
    );
  }
} 