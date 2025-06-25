import { NextResponse } from 'next/server';
import { unlink, readFile, writeFile, stat } from 'fs/promises';
import { MongoClient } from 'mongodb';
import path from 'path';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const ANNOTATION_COLLECTION = 'annotation';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const imagesDir = path.join(process.cwd(), 'public', 'data', 'images');
    const pdfsDir = path.join(process.cwd(), 'public', 'data', 'pdfs');
    const jsonsDir = path.join(process.cwd(), 'public', 'data', 'jsons');
    const audioDir = path.join(process.cwd(), 'public', 'data', 'audio');
    
    let filepath = '';
    let metadataPath = '';
    let fileFound = false;

    // Check if file exists in images directory
    try {
      const imageFilepath = path.join(imagesDir, filename);
      await stat(imageFilepath);
      filepath = imageFilepath;
      metadataPath = path.join(imagesDir, 'metadata.json');
      fileFound = true;
    } catch {
      // File not found in images directory
    }

    // Check if file exists in PDFs directory
    if (!fileFound) {
      try {
        const pdfFilepath = path.join(pdfsDir, filename);
        await stat(pdfFilepath);
        filepath = pdfFilepath;
        metadataPath = path.join(pdfsDir, 'metadata.json');
        fileFound = true;
      } catch {
        // File not found in PDFs directory
      }
    }

    // Check if file exists in JSONs directory
    if (!fileFound) {
      try {
        const jsonFilepath = path.join(jsonsDir, filename);
        await stat(jsonFilepath);
        filepath = jsonFilepath;
        metadataPath = path.join(jsonsDir, 'metadata.json');
        fileFound = true;
      } catch {
        // File not found in JSONs directory
      }
    }

    // Check if file exists in audio directory
    if (!fileFound) {
      try {
        const audioFilepath = path.join(audioDir, filename);
        await stat(audioFilepath);
        filepath = audioFilepath;
        metadataPath = path.join(audioDir, 'metadata.json');
        fileFound = true;
      } catch {
        // File not found in audio directory
      }
    }

    if (!fileFound) {
      return NextResponse.json(
        { error: 'Data file not found' },
        { status: 404 }
      );
    }

    try {
      // Delete the file
      await unlink(filepath);
      
      // Remove metadata from metadata.json
      try {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const metadataList = JSON.parse(metadataContent);
        const updatedMetadata = metadataList.filter((item: any) => item.filename !== filename);
        await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
      } catch (error: any) {
        // Metadata file doesn't exist or is invalid, ignore
        if (error.code === 'ENOENT') {
          console.log('Metadata file does not exist, skipping metadata cleanup');
        } else {
          console.log('Could not update metadata file:', error.message);
        }
      }

      // Remove annotation data from MongoDB
      try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();

        const database = client.db(DATABASE_NAME);
        const collection = database.collection(ANNOTATION_COLLECTION);

        // Delete annotation document for this file
        const deleteResult = await collection.deleteOne({ dataId: filename });
        
        await client.close();

        if (deleteResult.deletedCount > 0) {
          console.log(`Deleted annotation data for file: ${filename}`);
        } else {
          console.log(`No annotation data found for file: ${filename}`);
        }
      } catch (error) {
        console.error('Error deleting annotation data from MongoDB:', error);
        // Don't fail the entire operation if MongoDB deletion fails
      }
      
      return NextResponse.json({ 
        success: true,
        message: `File "${filename}" and all related data deleted successfully`
      });
    } catch {
      // File doesn't exist or can't be deleted
      return NextResponse.json(
        { error: 'Data file not found or cannot be deleted' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data file' },
      { status: 500 }
    );
  }
} 