import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { readFile } from 'fs/promises';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';

// Helper function to extract key-value pairs from JSON
async function extractJsonKeyValues(jsonPath: string): Promise<{ [key: string]: any }> {
  try {
    const jsonContent = await readFile(jsonPath, 'utf8');
    const jsonData = JSON.parse(jsonContent);
    
    // Flatten nested objects
    function flattenObject(obj: any, prefix: string = ''): { [key: string]: any } {
      const flattened: { [key: string]: any } = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(flattened, flattenObject(obj[key], newKey));
          } else {
            flattened[newKey] = obj[key];
          }
        }
      }
      
      return flattened;
    }
    
    return flattenObject(jsonData);
  } catch (error) {
    console.error('Error extracting JSON key-values:', error);
    return {};
  }
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
    
    console.log('Starting JSON analysis for file:', fileId);
    
    // Convert string fileId to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
    
    // Get the JSON file from database
    const jsonFile = await db.collection('files').findOne({ _id: objectId });
    
    if (!jsonFile) {
      console.log('JSON file not found in database');
      await client.close();
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    console.log('Found JSON file:', jsonFile.filename);

    // Get existing annotations for comparison
    const existingAnnotations = await db.collection('annotation').find({}).toArray();
    console.log('Found existing annotations:', existingAnnotations.length);

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

    let analysisResults: {
      extractedKeys: Array<{ key: string; value: any }>;
      matchingSegments: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        source: string;
        matchedKey?: string;
        matchedValue?: string;
        snippet?: string;
      }>;
      confidence: number;
      category: string;
    } = {
      extractedKeys: [],
      matchingSegments: [],
      confidence: 0,
      category: 'uncategorized'
    };

    try {
      // Extract key-value pairs from JSON
      console.log('Extracting JSON key-value pairs...');
      
      // Build the full file path
      const filePath = path.join(process.cwd(), 'public', jsonFile.url);
      console.log('Using JSON file path:', filePath);
      
      const keyValues = await extractJsonKeyValues(filePath);
      
      analysisResults.extractedKeys = Object.entries(keyValues).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      }));

      console.log('Extracted keys:', analysisResults.extractedKeys.length);

      // Find matching segments based on extracted values and existing annotations
      if (analysisResults.extractedKeys.length > 0 && existingAnnotations.length > 0) {
        console.log('Finding matching segments...');
        
        const matchingSegments: Array<{ 
          text: string; 
          category: string; 
          confidence: number; 
          source: string;
          matchedKey?: string;
          matchedValue?: string;
          snippet?: string;
        }> = [];
        
        for (const annotationRecord of existingAnnotations) {
          // Handle the actual database structure
          if (annotationRecord.annotations && Array.isArray(annotationRecord.annotations)) {
            for (const annotation of annotationRecord.annotations) {
              // Check for JSON key-value pairs in JSON annotations
              if (annotation.jsonKey && annotation.jsonValue && annotation.annotationType === 'json') {
                const annotationKeyLower = annotation.jsonKey.toLowerCase();
                const annotationValueLower = annotation.jsonValue.toLowerCase();
                
                console.log(`Processing JSON annotation with key: "${annotation.jsonKey}" and value: "${annotation.jsonValue}"`);
                
                // Check if any extracted value contains annotation key or value
                for (const extractedKey of analysisResults.extractedKeys) {
                  const extractedKeyLower = extractedKey.key.toLowerCase();
                  const extractedValueLower = extractedKey.value.toLowerCase();
                  
                  let confidence = 0;
                  let matchType = '';
                  
                  // Check for exact key match
                  if (extractedKeyLower === annotationKeyLower) {
                    confidence = 0.95;
                    matchType = 'exact_key';
                    console.log(`Exact key match found: "${annotation.jsonKey}"`);
                  }
                  // Check for partial key match
                  else if (extractedKeyLower.includes(annotationKeyLower) || annotationKeyLower.includes(extractedKeyLower)) {
                    confidence = 0.8;
                    matchType = 'partial_key';
                    console.log(`Partial key match found: "${annotation.jsonKey}" in "${extractedKey.key}"`);
                  }
                  // Check for exact value match
                  else if (extractedValueLower === annotationValueLower) {
                    confidence = 0.9;
                    matchType = 'exact_value';
                    console.log(`Exact value match found: "${annotation.jsonValue}"`);
                  }
                  // Check for partial value match
                  else if (extractedValueLower.includes(annotationValueLower) || annotationValueLower.includes(extractedValueLower)) {
                    confidence = 0.7;
                    matchType = 'partial_value';
                    console.log(`Partial value match found: "${annotation.jsonValue}" in "${extractedKey.value}"`);
                  }
                  
                  if (confidence > 0) {
                    // Get category from rule
                    const categoryId = annotationRecord.rule?.categoryId || 'unknown';
                    const categoryName = categoryMap.get(categoryId) || categoryId;
                    
                    // Create snippet showing the match
                    const snippet = `Key: "${extractedKey.key}" = Value: "${extractedKey.value}"`;
                    
                    matchingSegments.push({
                      text: `${annotation.jsonKey}: ${annotation.jsonValue}`,
                      category: categoryName,
                      confidence: confidence,
                      source: `json_${matchType}_match`,
                      matchedKey: extractedKey.key,
                      matchedValue: extractedKey.value,
                      snippet: snippet
                    });
                    
                    console.log(`Added JSON match: "${annotation.jsonKey}: ${annotation.jsonValue}" (confidence: ${confidence.toFixed(2)}, type: ${matchType})`);
                    break; // Found a match for this annotation, move to next
                  }
                }
              }
            }
          }
        }
        
        analysisResults.matchingSegments = matchingSegments;
        console.log('Found matching segments:', matchingSegments.length);
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
        extractedKeysCount: analysisResults.extractedKeys.length
      });

    } catch (error) {
      console.error('JSON analysis error:', error);
      analysisResults.category = 'uncategorized';
      analysisResults.confidence = 0;
    }
    
    await client.close();
    
    console.log('JSON analysis completed successfully');
    
    return NextResponse.json({
      success: true,
      category: analysisResults.category,
      confidence: analysisResults.confidence,
      score: analysisResults.confidence,
      analysisResults: analysisResults,
      destPath: `/category/${analysisResults.category.toLowerCase().replace(/\s+/g, '-')}`
    });
    
  } catch (error) {
    console.error('JSON auto-categorize error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process JSON file',
      category: 'uncategorized',
      confidence: 0,
      score: 0
    }, { status: 500 });
  }
} 