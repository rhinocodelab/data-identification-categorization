import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileType, filePath } = body;
    
    // Handle both new format (fileId, fileType) and legacy format (filePath)
    if (fileId && fileType) {
      // New format - delegate to specific file type API
      const validFileTypes = ['image', 'audio', 'json', 'pdf'];
      if (!validFileTypes.includes(fileType)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }

      // Get the file from database to verify it exists
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db(DATABASE_NAME);
      
      const file = await db.collection('files').findOne({ _id: fileId });
      if (!file) {
        await client.close();
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      
      await client.close();

      // Delegate to the specific file type API
      const apiUrl = `${request.nextUrl.origin}/api/auto-categorize/${fileType}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        return NextResponse.json(result, { status: response.status });
      }

      return NextResponse.json(result);

    } else if (filePath) {
      // Legacy format - handle file path-based auto-categorization
      try {
        // Determine file type from file extension
        const fileExtension = path.extname(filePath).toLowerCase();
        let detectedFileType: string;
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExtension)) {
          detectedFileType = 'image';
        } else if (['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'].includes(fileExtension)) {
          detectedFileType = 'audio';
        } else if (['.json'].includes(fileExtension)) {
          detectedFileType = 'json';
        } else if (['.pdf'].includes(fileExtension)) {
          detectedFileType = 'pdf';
        } else {
          return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        // Create a temporary file record in the database
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(DATABASE_NAME);
        
        // Ensure the filePath has a leading slash for proper URL formatting
        const normalizedFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        
        const tempFile = {
          filename: path.basename(filePath),
          url: normalizedFilePath,
          fileType: detectedFileType,
          uploadedAt: new Date(),
          temp: true
        };
        
        const result = await db.collection('files').insertOne(tempFile);
        const fileId = result.insertedId;
        
        await client.close();

        // Delegate to the specific file type API
        const apiUrl = `${request.nextUrl.origin}/api/auto-categorize/${detectedFileType}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId: fileId.toString() }),
        });

        const apiResult = await response.json();
        
        if (!response.ok) {
          return NextResponse.json(apiResult, { status: response.status });
        }

        // Clean up temporary file record
        const cleanupClient = new MongoClient(MONGODB_URI);
        await cleanupClient.connect();
        const cleanupDb = cleanupClient.db(DATABASE_NAME);
        await cleanupDb.collection('files').deleteOne({ _id: fileId });
        await cleanupClient.close();

        return NextResponse.json(apiResult);

      } catch (error) {
        console.error('File path auto-categorize error:', error);
        return NextResponse.json({ error: 'Failed to process file path' }, { status: 500 });
      }

    } else {
      return NextResponse.json({ error: 'File ID and type are required, or file path is required' }, { status: 400 });
    }

  } catch (error) {
    console.error('Auto-categorize router error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 