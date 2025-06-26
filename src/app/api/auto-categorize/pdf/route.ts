import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { access } from 'fs/promises';
import pdfParse from 'pdf-parse-v2';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';

// Helper function to extract text from PDF
async function extractPdfText(pdfPath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    let extractedText = data.text || '';
    
    // If text extraction failed or returned very little text, log it
    if (extractedText.length < 50) {
      console.log('PDF text extraction returned very little text:', extractedText.length, 'characters');
      console.log('This might indicate an image-based PDF or OCR issues');
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
      .trim();
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
}

// Helper function to extract pages from PDF
async function extractPdfPages(pdfPath: string): Promise<string[]> {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    // pdf-parse-v2 doesn't provide page information, so we'll split the text
    const fullText = data.text || '';
    
    // Split text by common page break indicators or large gaps
    const pages = fullText.split(/\f|\n\s*\n\s*\n/).filter(page => page.trim().length > 0);
    
    return pages.length > 0 ? pages : [fullText];
  } catch (error) {
    console.error('Error extracting PDF pages:', error);
    return [];
  }
}

// Helper function to calculate keyword match confidence
function calculateKeywordMatchConfidence(extractedText: string, keyword: string): number {
  const extractedLower = extractedText.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // Exact match gets highest confidence
  if (extractedLower.includes(keywordLower)) {
    return 0.9;
  }
  
  // Handle multi-word keywords
  const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 2);
  const extractedWords = extractedLower.split(/\s+/);
  
  if (keywordWords.length === 0) {
    return 0;
  }
  
  let matchCount = 0;
  let totalWordScore = 0;
  
  for (const keywordWord of keywordWords) {
    let bestMatchScore = 0;
    
    for (const extractedWord of extractedWords) {
      // Exact word match
      if (extractedWord === keywordWord) {
        bestMatchScore = 1.0;
        break;
      }
      // Contains match
      else if (extractedWord.includes(keywordWord) || keywordWord.includes(extractedWord)) {
        const similarity = Math.min(extractedWord.length, keywordWord.length) / 
                          Math.max(extractedWord.length, keywordWord.length);
        bestMatchScore = Math.max(bestMatchScore, similarity);
      }
      // Fuzzy match for similar words
      else if (keywordWord.length > 3 && extractedWord.length > 3) {
        const similarity = calculateWordSimilarity(keywordWord, extractedWord);
        if (similarity > 0.7) {
          bestMatchScore = Math.max(bestMatchScore, similarity * 0.8);
        }
      }
    }
    
    if (bestMatchScore > 0) {
      matchCount++;
      totalWordScore += bestMatchScore;
    }
  }
  
  if (matchCount > 0) {
    // Calculate overall confidence based on word matches and coverage
    const coverageScore = matchCount / keywordWords.length;
    const averageWordScore = totalWordScore / matchCount;
    return Math.min(0.8, (coverageScore * 0.6) + (averageWordScore * 0.4));
  }
  
  return 0;
}

// Helper function to calculate word similarity (simple implementation)
function calculateWordSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1.0;
  
  const len1 = word1.length;
  const len2 = word2.length;
  
  // If length difference is too large, similarity is low
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0;
  }
  
  // Simple character-based similarity
  let commonChars = 0;
  const minLen = Math.min(len1, len2);
  
  for (let i = 0; i < minLen; i++) {
    if (word1[i] === word2[i]) {
      commonChars++;
    }
  }
  
  return commonChars / Math.max(len1, len2);
}

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    console.log('Starting PDF analysis for file:', fileId);
    
    // Convert string fileId to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
    
    // Get the PDF file from database
    const pdfFile = await db.collection('files').findOne({ _id: objectId });
    
    if (!pdfFile) {
      console.log('PDF file not found in database');
      await client.close();
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
    }

    console.log('Found PDF file:', pdfFile.filename);
    console.log('Original URL from database:', pdfFile.url);

    // Get existing annotations for comparison
    const existingAnnotations = await db.collection('annotation').find({}).toArray();
    console.log('Found existing annotations:', existingAnnotations.length);
    
    // Debug: Log annotation details to identify PDF annotations
    existingAnnotations.forEach((record, index) => {
      console.log(`Annotation record ${index + 1}:`, {
        id: record._id,
        dataId: record.dataId,
        annotationsCount: record.annotations?.length || 0,
        annotations: record.annotations?.map((ann: any) => ({
          id: ann.id,
          label: ann.label,
          annotationType: ann.annotationType,
          keywordText: ann.keywordText
        }))
      });
    });

    // Get categories for mapping category IDs to names
    const categories = await db.collection('category').find({}).toArray();
    const categoryMap = new Map();
    categories.forEach(cat => {
      // Categories use 'id' field, not '_id'
      if (cat.id) {
        categoryMap.set(cat.id, cat.name);
      }
      // Also try _id as fallback for backward compatibility
      if (cat._id) {
        categoryMap.set(cat._id.toString(), cat.name);
      }
    });
    
    // Debug: Log the category map
    console.log('Category map created:', Object.fromEntries(categoryMap));

    let analysisResults: {
      extractedText: string;
      pages: Array<{ pageNumber: number; content: string }>;
      matchingSegments: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        source: string; 
        pageNumber?: number;
        annotationId: string;
        matchType: 'exact' | 'partial' | 'keyword';
      }>;
      confidence: number;
      category: string;
      pdfUrl?: string;
    } = {
      extractedText: '',
      pages: [],
      matchingSegments: [],
      confidence: 0,
      category: 'uncategorized',
      pdfUrl: pdfFile.url
    };

    try {
      // Handle file path - convert relative path to absolute path
      let pdfPath = pdfFile.url;
      if (pdfPath.startsWith('/')) {
        // Remove leading slash and convert to absolute path
        pdfPath = path.join(process.cwd(), 'public', pdfPath.slice(1));
      } else if (!path.isAbsolute(pdfPath)) {
        // If it's a relative path, make it absolute
        pdfPath = path.join(process.cwd(), 'public', pdfPath);
      }
      
      console.log('Using PDF path:', pdfPath);
      
      // Check if file exists
      try {
        await access(pdfPath);
        console.log('PDF file exists and is accessible');
      } catch {
        console.error('PDF file not found or not accessible:', pdfPath);
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      // Extract text from PDF
      console.log('Extracting PDF text...');
      analysisResults.extractedText = await extractPdfText(pdfPath);
      console.log('Extracted text length:', analysisResults.extractedText.length);
      console.log('Extracted text preview:', analysisResults.extractedText.substring(0, 500) + '...');
      
      // Extract pages from PDF
      console.log('Extracting PDF pages...');
      const pageContents = await extractPdfPages(pdfPath);
      
      analysisResults.pages = pageContents.map((content, index) => ({
        pageNumber: index + 1,
        content
      }));

      console.log('Extracted pages:', analysisResults.pages.length);

      // Find matching segments based on extracted text and existing annotations
      if (analysisResults.extractedText && existingAnnotations.length > 0) {
        console.log('Finding matching segments...');
        
        const matchingSegments: Array<{ 
          text: string; 
          category: string; 
          confidence: number; 
          source: string; 
          pageNumber?: number;
          annotationId: string;
          matchType: 'exact' | 'partial' | 'keyword';
        }> = [];
        const extractedTextLower = analysisResults.extractedText.toLowerCase();
        
        // Debug: Log all PDF annotations found
        let pdfAnnotationCount = 0;
        for (const annotationRecord of existingAnnotations) {
          if (annotationRecord.annotations && Array.isArray(annotationRecord.annotations)) {
            for (const annotation of annotationRecord.annotations) {
              if (annotation.keywordText && annotation.annotationType === 'pdf') {
                pdfAnnotationCount++;
                console.log(`Found PDF annotation: "${annotation.keywordText}" (ID: ${annotation.id})`);
              }
            }
          }
        }
        console.log(`Total PDF annotations found: ${pdfAnnotationCount}`);
        
        for (const annotationRecord of existingAnnotations) {
          // Handle the actual database structure
          if (annotationRecord.annotations && Array.isArray(annotationRecord.annotations)) {
            for (const annotation of annotationRecord.annotations) {
              // Check for keyword text in PDF annotations
              if (annotation.keywordText && annotation.annotationType === 'pdf') {
                console.log(`Processing PDF annotation with keywordText: "${annotation.keywordText}"`);
                
                const annotationTextLower = annotation.keywordText.toLowerCase();
                
                // Calculate match confidence
                const confidence = calculateKeywordMatchConfidence(analysisResults.extractedText, annotation.keywordText);
                console.log(`Match confidence for "${annotation.keywordText}": ${confidence.toFixed(3)}`);
                
                // Determine match type
                let matchType: 'exact' | 'partial' | 'keyword' = 'keyword';
                if (extractedTextLower.includes(annotationTextLower)) {
                  matchType = 'exact';
                  console.log(`Exact match found for: "${annotation.keywordText}"`);
                } else if (confidence > 0.3) {
                  matchType = 'partial';
                  console.log(`Partial match found for: "${annotation.keywordText}"`);
                }
                
                // Lower the confidence threshold for better matching
                if (confidence > 0.1) {
                  // Find which page contains the match
                  let pageNumber: number | undefined;
                  for (const page of analysisResults.pages) {
                    if (page.content.toLowerCase().includes(annotationTextLower)) {
                      pageNumber = page.pageNumber;
                      break;
                    }
                  }
                  
                  // Get category from rule
                  const categoryId = annotationRecord.rule?.categoryId || 'unknown';
                  const categoryName = categoryMap.get(categoryId) || categoryId;
                  
                  matchingSegments.push({
                    text: annotation.keywordText,
                    category: categoryName,
                    confidence: confidence,
                    source: 'pdf_keyword_match',
                    pageNumber,
                    annotationId: annotation.id,
                    matchType
                  });
                  
                  console.log(`Added keyword match: "${annotation.keywordText}" (confidence: ${confidence.toFixed(2)}, type: ${matchType})`);
                } else {
                  console.log(`No match found for: "${annotation.keywordText}" (confidence: ${confidence.toFixed(3)})`);
                }
              }
            }
          }
        }
        
        analysisResults.matchingSegments = matchingSegments;
        console.log('Found matching segments:', matchingSegments.length);
      } else {
        console.log('No extracted text or no existing annotations found');
        if (!analysisResults.extractedText) {
          console.log('Extracted text is empty or null');
        }
        if (existingAnnotations.length === 0) {
          console.log('No existing annotations found in database');
        }
      }

      // Determine category based on matching segments
      if (analysisResults.matchingSegments.length > 0) {
        // Group by category and find the most common
        const categoryCounts: { [key: string]: number } = {};
        analysisResults.matchingSegments.forEach(segment => {
          categoryCounts[segment.category] = (categoryCounts[segment.category] || 0) + 1;
        });
        
        const mostCommonCategory = Object.keys(categoryCounts).reduce((a, b) => 
          categoryCounts[a] > categoryCounts[b] ? a : b
        );
        
        analysisResults.category = mostCommonCategory;
        analysisResults.confidence = Math.max(...analysisResults.matchingSegments.map(s => s.confidence));
      } else {
        analysisResults.category = 'uncategorized';
        analysisResults.confidence = 0;
      }

      console.log('Final analysis results:', {
        category: analysisResults.category,
        confidence: analysisResults.confidence,
        matchingSegmentsCount: analysisResults.matchingSegments.length,
        extractedTextLength: analysisResults.extractedText.length,
        pagesCount: analysisResults.pages.length
      });

    } catch (analysisError) {
      console.error('PDF analysis error:', analysisError);
      // Fallback analysis
      analysisResults = {
        extractedText: '',
        pages: [],
        matchingSegments: [],
        confidence: 0,
        category: 'uncategorized',
        pdfUrl: pdfFile.url
      };
    }

    // Update the file with analysis results
    await db.collection('files').updateOne(
      { _id: objectId },
      { 
        $set: { 
          category: analysisResults.category,
          confidence: analysisResults.confidence,
          analysisResults: analysisResults,
          analyzedAt: new Date()
        }
      }
    );

    await client.close();
    console.log('PDF analysis completed successfully');
    return NextResponse.json({ 
      success: true, 
      category: analysisResults.category,
      confidence: analysisResults.confidence,
      analysisResults: analysisResults
    });

  } catch (error) {
    console.error('PDF auto-categorize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 