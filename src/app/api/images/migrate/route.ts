import { NextResponse } from 'next/server';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import path from 'path';

export async function POST() {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'data', 'images');
    
    // Check if directory exists
    try {
      await stat(uploadDir);
    } catch {
      return NextResponse.json(
        { error: 'Upload directory does not exist' },
        { status: 404 }
      );
    }

    // Read existing metadata if it exists
    const metadataPath = path.join(uploadDir, 'metadata.json');
    let existingMetadata: any[] = [];
    
    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      existingMetadata = JSON.parse(metadataContent);
    } catch (error) {
      // Metadata file doesn't exist, start with empty array
      existingMetadata = [];
    }

    // Read all files in the directory
    let files = await readdir(uploadDir);
    // Filter out hidden files and metadata.json
    files = files.filter((filename) => !filename.startsWith('.') && filename !== 'metadata.json');
    
    // Get metadata for each file
    const fileMetadata = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(uploadDir, filename);
        const stats = await stat(filepath);
        
        // Check if metadata already exists for this file
        const existingEntry = existingMetadata.find((item: any) => item.filename === filename);
        
        if (existingEntry) {
          return existingEntry;
        }
        
        // Create new metadata entry
        return {
          filename,
          originalName: filename, // Use filename as original name for existing files
          size: stats.size,
          type: path.extname(filename),
          uploadDate: stats.birthtime.toISOString(),
          url: `/data/images/${filename}`
        };
      })
    );

    // Save updated metadata
    await writeFile(metadataPath, JSON.stringify(fileMetadata, null, 2));

    return NextResponse.json({
      success: true,
      message: `Migrated ${fileMetadata.length} files to metadata system`,
      filesProcessed: fileMetadata.length
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate files' },
      { status: 500 }
    );
  }
} 