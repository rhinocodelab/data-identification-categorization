import { NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'data', 'images');
    const pdfsDir = path.join(process.cwd(), 'public', 'data', 'pdfs');
    const jsonsDir = path.join(process.cwd(), 'public', 'data', 'jsons');
    const audioDir = path.join(process.cwd(), 'public', 'data', 'audio');
    
    let allFiles: any[] = [];

    // Process images directory
    try {
      await stat(imagesDir);
      const imagesMetadataPath = path.join(imagesDir, 'metadata.json');
      
      try {
        const imagesMetadataContent = await readFile(imagesMetadataPath, 'utf-8');
        const imagesList = JSON.parse(imagesMetadataContent);
        allFiles = [...allFiles, ...imagesList];
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('No images metadata file found, reading directory...');
        } else {
          console.log('Error reading images metadata file:', error.message);
        }
        
        // Read all files in the images directory
        let imageFiles = await readdir(imagesDir);
        imageFiles = imageFiles.filter((filename) => !filename.startsWith('.') && filename !== 'metadata.json');
        
        const imageMetadataList = await Promise.all(
          imageFiles.map(async (filename) => {
            const filepath = path.join(imagesDir, filename);
            const stats = await stat(filepath);
            
            return {
              filename,
              originalName: filename,
              size: stats.size,
              type: path.extname(filename),
              fileType: 'image',
              uploadDate: stats.birthtime.toISOString(),
              url: `/data/images/${filename}`
            };
          })
        );
        allFiles = [...allFiles, ...imageMetadataList];
      }
    } catch (error) {
      console.log('Images directory does not exist');
    }

    // Process PDFs directory
    try {
      await stat(pdfsDir);
      const pdfsMetadataPath = path.join(pdfsDir, 'metadata.json');
      
      try {
        const pdfsMetadataContent = await readFile(pdfsMetadataPath, 'utf-8');
        const pdfsList = JSON.parse(pdfsMetadataContent);
        allFiles = [...allFiles, ...pdfsList];
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('No PDFs metadata file found, reading directory...');
        } else {
          console.log('Error reading PDFs metadata file:', error.message);
        }
        
        // Read all files in the PDFs directory
        let pdfFiles = await readdir(pdfsDir);
        pdfFiles = pdfFiles.filter((filename) => !filename.startsWith('.') && filename !== 'metadata.json');
        
        const pdfMetadataList = await Promise.all(
          pdfFiles.map(async (filename) => {
            const filepath = path.join(pdfsDir, filename);
            const stats = await stat(filepath);
            
            return {
              filename,
              originalName: filename,
              size: stats.size,
              type: path.extname(filename),
              fileType: 'pdf',
              uploadDate: stats.birthtime.toISOString(),
              url: `/data/pdfs/${filename}`
            };
          })
        );
        allFiles = [...allFiles, ...pdfMetadataList];
      }
    } catch (error) {
      console.log('PDFs directory does not exist');
    }

    // Process JSONs directory
    try {
      await stat(jsonsDir);
      const jsonsMetadataPath = path.join(jsonsDir, 'metadata.json');
      
      try {
        const jsonsMetadataContent = await readFile(jsonsMetadataPath, 'utf-8');
        const jsonsList = JSON.parse(jsonsMetadataContent);
        allFiles = [...allFiles, ...jsonsList];
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('No JSONs metadata file found, reading directory...');
        } else {
          console.log('Error reading JSONs metadata file:', error.message);
        }
        
        // Read all files in the JSONs directory
        let jsonFiles = await readdir(jsonsDir);
        jsonFiles = jsonFiles.filter((filename) => !filename.startsWith('.') && filename !== 'metadata.json');
        
        const jsonMetadataList = await Promise.all(
          jsonFiles.map(async (filename) => {
            const filepath = path.join(jsonsDir, filename);
            const stats = await stat(filepath);
            
            return {
              filename,
              originalName: filename,
              size: stats.size,
              type: path.extname(filename),
              fileType: 'json',
              uploadDate: stats.birthtime.toISOString(),
              url: `/data/jsons/${filename}`
            };
          })
        );
        allFiles = [...allFiles, ...jsonMetadataList];
      }
    } catch (error) {
      console.log('JSONs directory does not exist');
    }

    // Process audio directory
    try {
      await stat(audioDir);
      const audioMetadataPath = path.join(audioDir, 'metadata.json');
      
      try {
        const audioMetadataContent = await readFile(audioMetadataPath, 'utf-8');
        const audioList = JSON.parse(audioMetadataContent);
        allFiles = [...allFiles, ...audioList];
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('No audio metadata file found, reading directory...');
        } else {
          console.log('Error reading audio metadata file:', error.message);
        }
        
        // Read all files in the audio directory
        let audioFiles = await readdir(audioDir);
        audioFiles = audioFiles.filter((filename) => !filename.startsWith('.') && filename !== 'metadata.json');
        
        const audioMetadataList = await Promise.all(
          audioFiles.map(async (filename) => {
            const filepath = path.join(audioDir, filename);
            const stats = await stat(filepath);
            
            return {
              filename,
              originalName: filename,
              size: stats.size,
              type: path.extname(filename),
              fileType: 'audio',
              uploadDate: stats.birthtime.toISOString(),
              url: `/data/audio/${filename}`
            };
          })
        );
        allFiles = [...allFiles, ...audioMetadataList];
      }
    } catch (error) {
      console.log('Audio directory does not exist');
    }

    // Sort by upload date (newest first)
    allFiles.sort((a: any, b: any) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    return NextResponse.json(allFiles);
  } catch (error) {
    console.error('Error reading data files:', error);
    return NextResponse.json(
      { error: 'Failed to read data files' },
      { status: 500 }
    );
  }
} 