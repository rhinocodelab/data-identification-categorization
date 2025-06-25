import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const autoCategorizedPath = path.join(process.cwd(), 'public', 'auto-categorized');
    
    // Check if the directory exists
    if (!fs.existsSync(autoCategorizedPath)) {
      return NextResponse.json({ 
        success: true, 
        message: 'No data to clear - auto-categorized directory does not exist' 
      });
    }

    // Function to recursively delete directory contents
    const clearDirectory = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            clearDirectory(itemPath);
            fs.rmdirSync(itemPath);
          } else {
            fs.unlinkSync(itemPath);
          }
        }
      }
    };

    // Clear all subdirectories in auto-categorized
    const subdirs = fs.readdirSync(autoCategorizedPath);
    let deletedCount = 0;
    
    for (const subdir of subdirs) {
      const subdirPath = path.join(autoCategorizedPath, subdir);
      const stat = fs.statSync(subdirPath);
      
      if (stat.isDirectory()) {
        clearDirectory(subdirPath);
        fs.rmdirSync(subdirPath);
        deletedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${deletedCount} directories and their contents`,
      deletedCount
    });

  } catch (error: any) {
    console.error('Error clearing data:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to clear data' 
    }, { status: 500 });
  }
} 