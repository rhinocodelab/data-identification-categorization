import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    const isJSON = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isImage && !isPDF && !isJSON && !isAudio) {
      return NextResponse.json(
        { error: 'Only image, PDF, JSON, and audio files are supported' },
        { status: 400 }
      );
    }

    // Create the appropriate upload directory
    let uploadDir: string;
    if (isImage) {
      uploadDir = path.join(process.cwd(), 'public', 'data', 'images');
    } else if (isPDF) {
      uploadDir = path.join(process.cwd(), 'public', 'data', 'pdfs');
    } else if (isAudio) {
      uploadDir = path.join(process.cwd(), 'public', 'data', 'audio');
    } else {
      uploadDir = path.join(process.cwd(), 'public', 'data', 'jsons');
    }
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const filename = `${timestamp}${fileExtension}`;
    const filepath = path.join(uploadDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Create metadata
    const metadata = {
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      fileType: isImage ? 'image' : isPDF ? 'pdf' : isAudio ? 'audio' : 'json',
      uploadDate: new Date().toISOString(),
      url: isImage ? `/data/images/${filename}` : isPDF ? `/data/pdfs/${filename}` : isAudio ? `/data/audio/${filename}` : `/data/jsons/${filename}`
    };

    // Save metadata to JSON file
    const metadataPath = path.join(uploadDir, 'metadata.json');
    let allMetadata = [];
    
    try {
      const existingMetadata = await readFile(metadataPath, 'utf-8');
      allMetadata = JSON.parse(existingMetadata);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      allMetadata = [];
    }

    // Add new metadata
    allMetadata.push(metadata);
    
    // Save updated metadata
    await writeFile(metadataPath, JSON.stringify(allMetadata, null, 2));

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 