import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import path from 'path';
import { access } from 'fs/promises';
import { ImageMatcher } from '@/utils/imageMatching';
import sharp from 'sharp';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const GOOGLE_CREDENTIALS_PATH = path.join(process.cwd(), 'src', 'config', 'isl.json');

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    console.log('Starting image analysis for file:', fileId);
    
    // Convert string fileId to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
    
    // Get the image file from database
    const imageFile = await db.collection('files').findOne({ _id: objectId });
    
    if (!imageFile) {
      console.log('Image file not found in database');
      await client.close();
      return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
    }

    console.log('Found image file:', imageFile.filename);
    console.log('Original URL from database:', imageFile.url);
    
    // Get actual image dimensions if not available in database
    let imageDimensions = imageFile.dimensions || { width: 0, height: 0 };
    if (!imageDimensions.width || !imageDimensions.height) {
      try {
        const imagePath = path.join(process.cwd(), 'public', imageFile.url.replace(/^\//, ''));
        const metadata = await sharp(imagePath).metadata();
        imageDimensions = {
          width: metadata.width || 0,
          height: metadata.height || 0
        };
        console.log('Extracted image dimensions:', imageDimensions);
      } catch (error) {
        console.log('Could not extract image dimensions:', (error as Error).message);
      }
    }

    // Initialize Google Cloud Vision client with credentials
    const vision = new ImageAnnotatorClient({
      keyFilename: GOOGLE_CREDENTIALS_PATH
    });

    // Get existing annotations for comparison
    const existingAnnotations = await db.collection('annotation').find({}).toArray();
    console.log('Found existing annotations:', existingAnnotations.length);
    
    // Get existing annotated images for visual comparison
    const existingAnnotatedImages = await db.collection('files')
      .find({ 
        category: { $ne: 'uncategorized' },
        analysisResults: { $exists: true },
        'analysisResults.visualMatches': { $exists: true, $ne: [] }
      })
      .toArray();
    console.log('Found existing annotated images for visual comparison:', existingAnnotatedImages.length);
    
    // Debug: Log annotation details to identify duplicates
    existingAnnotations.forEach((record, index) => {
      console.log(`Annotation record ${index + 1}:`, {
        id: record._id,
        dataId: record.dataId,
        annotationsCount: record.annotations?.length || 0,
        annotations: record.annotations?.map((ann: any) => ({
          id: ann.id,
          label: ann.label,
          annotationType: ann.annotationType,
          ocrText: ann.ocrText
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

    let analysisResults: {
      ocrText: string;
      detectedObjects: Array<{ name: string; confidence: number }>;
      textMatches: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        boundingBox: { x1: number; y1: number; x2: number; y2: number };
        annotationBoundingBox: { x1: number; y1: number; x2: number; y2: number };
        annotationId: string;
      }>;
      visualMatches: Array<{ 
        text: string; 
        category: string; 
        confidence: number; 
        boundingBox: { x1: number; y1: number; x2: number; y2: number };
        annotationId: string;
      }>;
      confidence: number;
      category: string;
      imageUrl?: string;
      imageDimensions?: { width: number; height: number };
    } = {
      ocrText: '',
      detectedObjects: [],
      textMatches: [],
      visualMatches: [],
      confidence: 0,
      category: 'uncategorized',
      imageUrl: imageFile.url,
      imageDimensions: imageDimensions
    };

    try {
      // Handle file path - convert relative path to absolute path
      let imagePath = imageFile.url;
      if (imagePath.startsWith('/')) {
        // Remove leading slash and convert to absolute path
        imagePath = path.join(process.cwd(), 'public', imagePath.slice(1));
      } else if (!path.isAbsolute(imagePath)) {
        // If it's a relative path, make it absolute
        imagePath = path.join(process.cwd(), 'public', imagePath);
      }
      
      console.log('Using image path:', imagePath);
      
      // Check if file exists
      try {
        await access(imagePath);
        console.log('Image file exists and is accessible');
      } catch (error) {
        console.error('Image file not found or not accessible:', imagePath);
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      // Perform OCR on the image
      console.log('Performing OCR on image...');
      const [result] = await vision.textDetection(imagePath);
      const detections = result.textAnnotations || [];
      
      if (detections.length > 0) {
        analysisResults.ocrText = detections[0].description || '';
        console.log('OCR Text extracted:', analysisResults.ocrText.substring(0, 100) + '...');
      }

      // Perform object detection
      console.log('Performing object detection...');
      try {
        if (vision && typeof vision.objectLocalization === 'function') {
          const [objectResult] = await vision.objectLocalization(imagePath);
          const objects = objectResult.localizedObjectAnnotations || [];
          
          analysisResults.detectedObjects = objects.map((obj: any) => ({
            name: obj.name || '',
            confidence: obj.score || 0
          }));

          console.log('Detected objects:', analysisResults.detectedObjects.length);
        } else {
          console.log('Object localization not available');
          analysisResults.detectedObjects = [];
        }
      } catch (objectError) {
        console.error('Object detection error:', objectError);
        analysisResults.detectedObjects = [];
      }

      // Find matching segments based on OCR text and existing annotations
      if (analysisResults.ocrText && existingAnnotations.length > 0) {
        console.log('Finding matching segments...');
        
        const textMatches: Array<{ 
          text: string; 
          category: string; 
          confidence: number; 
          boundingBox: { x1: number; y1: number; x2: number; y2: number };
          annotationBoundingBox: { x1: number; y1: number; x2: number; y2: number };
          annotationId: string;
        }> = [];
        
        const visualMatches: Array<{ 
          text: string; 
          category: string; 
          confidence: number; 
          boundingBox: { x1: number; y1: number; x2: number; y2: number };
          annotationId: string;
        }> = [];
        
        const processedAnnotationIds = new Set<string>();
        
        // Process each annotation record from the database
        for (const annotationRecord of existingAnnotations) {
          if (annotationRecord.annotations && Array.isArray(annotationRecord.annotations)) {
            for (const annotation of annotationRecord.annotations) {
              // Only process annotations that have bounding boxes and haven't been processed
              if (annotation.x1 !== undefined && annotation.y1 !== undefined && 
                  annotation.x2 !== undefined && annotation.y2 !== undefined &&
                  !processedAnnotationIds.has(annotation.id)) {
                
                const annotationBbox = {
                  x1: annotation.x1,
                  y1: annotation.y1,
                  x2: annotation.x2,
                  y2: annotation.y2
                };
                
                // Get category from rule
                const categoryId = annotationRecord.rule?.categoryId || 'unknown';
                const categoryName = categoryMap.get(categoryId) || categoryId;
                
                if (annotation.annotationType === 'image' && annotation.ocrText) {
                  console.log(`Processing image annotation with ocrText: "${annotation.ocrText}"`);
                  
                  // For text annotations, find the best matching OCR detection within the annotation bounding box
                  let bestMatch = null;
                  let bestMatchScore = 0;
                  
                  for (let i = 1; i < detections.length; i++) { // Skip first detection (full text)
                    const detection = detections[i];
                    const detectedText = detection.description || '';
                    
                    // Check if the detected text bounding box overlaps with the annotation bounding box
                    if (detection.boundingPoly && detection.boundingPoly.vertices) {
                      const vertices = detection.boundingPoly.vertices;
                      if (vertices.length >= 4) {
                        const xCoords = vertices.map((v: any) => v.x || 0);
                        const yCoords = vertices.map((v: any) => v.y || 0);
                        const detectedBbox = {
                          x1: Math.min(...xCoords),
                          y1: Math.min(...yCoords),
                          x2: Math.max(...xCoords),
                          y2: Math.max(...yCoords)
                        };
                        
                        // Check if bounding boxes overlap
                        const overlap = !(detectedBbox.x2 < annotationBbox.x1 || 
                                        detectedBbox.x1 > annotationBbox.x2 || 
                                        detectedBbox.y2 < annotationBbox.y1 || 
                                        detectedBbox.y1 > annotationBbox.y2);
                        
                        if (overlap) {
                          // Check if the text content matches
                          const detectedTextLower = detectedText.toLowerCase();
                          const annotationTextLower = annotation.ocrText.toLowerCase();
                          
                          if (detectedTextLower.includes(annotationTextLower) || 
                              annotationTextLower.includes(detectedTextLower)) {
                            
                            // Calculate match score based on text similarity
                            const matchScore = Math.min(detectedTextLower.length, annotationTextLower.length) / 
                                             Math.max(detectedTextLower.length, annotationTextLower.length);
                            
                            if (matchScore > bestMatchScore) {
                              bestMatchScore = matchScore;
                              bestMatch = {
                                detectedText,
                                detectedBbox,
                                matchScore
                              };
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // Only add the best match for this annotation
                  if (bestMatch) {
                    console.log(`Found text match: OCR "${bestMatch.detectedText}" matches annotation "${annotation.ocrText}"`);
                    textMatches.push({
                      text: annotation.ocrText,
                      category: categoryName,
                      confidence: 0.8, // High confidence for text matches
                      boundingBox: bestMatch.detectedBbox,
                      annotationBoundingBox: annotationBbox,
                      annotationId: annotation.id
                    });
                  }
                  
                  processedAnnotationIds.add(annotation.id);
                  
                } else if (annotation.annotationType === 'visual') {
                  console.log(`Processing visual annotation with label: "${annotation.label}" (ID: ${annotation.id})`);
                  
                  // Check if we already have a visual match with the same label
                  const existingVisualMatch = visualMatches.find(match => match.text === annotation.label);
                  if (existingVisualMatch) {
                    console.log(`Skipping duplicate visual annotation with label: "${annotation.label}"`);
                    processedAnnotationIds.add(annotation.id);
                    continue;
                  }
                  
                  // For visual annotations, analyze the content within the bounding box using OpenCV-like matching
                  let visualElementDetected = false;
                  let visualContentType = 'Unknown';
                  let confidence = 0.5; // Default confidence
                  
                  try {
                    // Create a cropped image for the bounding box area
                    const imageBuffer = await sharp(imagePath).toBuffer();
                    
                    // Calculate crop dimensions
                    const cropX = Math.max(0, Math.round(annotationBbox.x1));
                    const cropY = Math.max(0, Math.round(annotationBbox.y1));
                    const cropWidth = Math.min(Math.round(annotationBbox.x2 - annotationBbox.x1), imageDimensions.width - cropX);
                    const cropHeight = Math.min(Math.round(annotationBbox.y2 - annotationBbox.y1), imageDimensions.height - cropY);
                    
                    if (cropWidth > 10 && cropHeight > 10) { // Minimum size for meaningful analysis
                      // Crop the image to the bounding box area
                      const croppedBuffer = await sharp(imageBuffer)
                        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
                        .png()
                        .toBuffer();
                      
                      console.log(`Analyzing visual content in bounding box: ${cropWidth}x${cropHeight} at (${cropX},${cropY})`);
                      
                      // Use our OpenCV-like image matching to analyze the cropped area
                      const croppedFeatures = await ImageMatcher.extractFeatures(croppedBuffer);
                      
                      // Check if vision client is available for additional analysis
                      if (vision && typeof vision.objectLocalization === 'function') {
                        // Perform object detection on the cropped area
                        const [objectResult] = await vision.objectLocalization(croppedBuffer);
                        const objects = objectResult?.localizedObjectAnnotations || [];
                        
                        // Perform logo detection on the cropped area
                        const [logoResult] = await vision.logoDetection(croppedBuffer);
                        const logos = logoResult?.logoAnnotations || [];
                        
                        // Perform image properties analysis for color and texture
                        const [propertiesResult] = await vision.imageProperties(croppedBuffer);
                        const properties = propertiesResult?.imagePropertiesAnnotation;
                        
                        console.log(`Found objects: ${objects.length}, logos: ${logos.length}`);
                        
                        // Determine if this is a meaningful visual element using both OpenCV-like analysis and Vision API
                        if (objects.length > 0) {
                          // Object detected - this is likely a meaningful visual element
                          const mainObject = objects[0];
                          visualElementDetected = true;
                          visualContentType = `Object: ${mainObject.name}`;
                          confidence = Math.min(0.9, 0.5 + (mainObject.score || 0) * 0.4);
                          console.log(`Visual element detected: ${visualContentType} (confidence: ${confidence})`);
                        } else if (logos.length > 0) {
                          // Logo detected
                          const mainLogo = logos[0];
                          visualElementDetected = true;
                          visualContentType = `Logo: ${mainLogo.description}`;
                          confidence = Math.min(0.9, 0.6 + (mainLogo.score || 0) * 0.3);
                          console.log(`Logo detected: ${visualContentType} (confidence: ${confidence})`);
                        } else {
                          // Use OpenCV-like analysis for visual pattern detection
                          const annotationArea = cropWidth * cropHeight;
                          const minArea = 500; // Minimum area for visual element
                          
                          // Analyze texture complexity and edge density from our OpenCV-like features
                          const hasSignificantTexture = croppedFeatures.texture > 50; // Threshold for texture complexity
                          const hasSignificantEdges = croppedFeatures.edges > 20; // Threshold for edge density
                          const hasDistinctColors = croppedFeatures.histogram.some((freq, i) => freq > 0.1); // Check for distinct color frequencies
                          
                          if ((hasSignificantTexture || hasSignificantEdges || hasDistinctColors) && annotationArea >= minArea) {
                            visualElementDetected = true;
                            visualContentType = `Visual Pattern (OpenCV-like analysis)`;
                            confidence = 0.7; // Higher confidence for OpenCV-like detection
                            console.log(`Visual pattern detected using OpenCV-like analysis: texture=${croppedFeatures.texture.toFixed(2)}, edges=${croppedFeatures.edges.toFixed(2)} (confidence: ${confidence})`);
                          } else if (properties && properties.dominantColors && properties.dominantColors.colors) {
                            // Fallback to Vision API color analysis
                            const colors = properties.dominantColors.colors;
                            const colorCount = colors.length;
                            const hasDistinctColors = colors.some(color => (color.score || 0) > 0.3);
                            
                            if (hasDistinctColors && annotationArea >= minArea) {
                              visualElementDetected = true;
                              visualContentType = `Visual Pattern (${colorCount} colors)`;
                              confidence = 0.6;
                              console.log(`Visual pattern detected: ${visualContentType} (confidence: ${confidence})`);
                            }
                          }
                        }
                      } else {
                        // Vision API not available, use only OpenCV-like analysis
                        const annotationArea = cropWidth * cropHeight;
                        const minArea = 300; // Lower threshold when only using OpenCV-like analysis
                        
                        // Analyze using our OpenCV-like features
                        const hasSignificantTexture = croppedFeatures.texture > 30;
                        const hasSignificantEdges = croppedFeatures.edges > 15;
                        const hasDistinctColors = croppedFeatures.histogram.some((freq, i) => freq > 0.05);
                        
                        if ((hasSignificantTexture || hasSignificantEdges || hasDistinctColors) && annotationArea >= minArea) {
                          visualElementDetected = true;
                          visualContentType = `Visual Pattern (OpenCV-like only)`;
                          confidence = 0.6;
                          console.log(`Visual pattern detected using OpenCV-like analysis only: texture=${croppedFeatures.texture.toFixed(2)}, edges=${croppedFeatures.edges.toFixed(2)} (confidence: ${confidence})`);
                        }
                      }
                    } else {
                      console.log(`Bounding box too small for analysis: ${cropWidth}x${cropHeight}`);
                    }
                  } catch (cropError) {
                    console.error('Error analyzing visual content:', cropError);
                    // Fallback: use simple area-based detection
                    const annotationArea = (annotationBbox.x2 - annotationBbox.x1) * (annotationBbox.y2 - annotationBbox.y1);
                    const minArea = 1000; // Higher threshold for fallback
                    if (annotationArea >= minArea) {
                      visualElementDetected = true;
                      visualContentType = 'Visual Element (fallback)';
                      confidence = 0.4;
                      console.log(`Visual element assumed based on area: ${annotationArea} (fallback)`);
                    }
                  }
                  
                  if (visualElementDetected) {
                    // Add visual match with content information
                    visualMatches.push({
                      text: visualContentType,
                      category: categoryName,
                      confidence: confidence,
                      boundingBox: annotationBbox,
                      annotationId: annotation.id
                    });
                    
                    console.log(`Added visual match: ${visualContentType} for label: "${annotation.label}"`);
                  } else {
                    console.log(`No meaningful visual content detected for annotation "${annotation.label}"`);
                  }
                  
                  processedAnnotationIds.add(annotation.id);
                }
              }
            }
          }
        }
        
        // Additional visual comparison with existing annotated images using OpenCV-like matching
        if (existingAnnotatedImages.length > 0 && visualMatches.length > 0) {
          console.log('Performing OpenCV-like visual comparison with existing annotated images...');
          
          try {
            const currentImageBuffer = await sharp(imagePath).toBuffer();
            const currentImageFeatures = await ImageMatcher.extractFeatures(currentImageBuffer);
            
            for (const existingImage of existingAnnotatedImages) {
              if (existingImage.url && existingImage.analysisResults?.visualMatches?.length > 0) {
                try {
                  // Get the existing image path
                  let existingImagePath = existingImage.url;
                  if (existingImagePath.startsWith('/')) {
                    existingImagePath = path.join(process.cwd(), 'public', existingImagePath.slice(1));
                  } else if (!path.isAbsolute(existingImagePath)) {
                    existingImagePath = path.join(process.cwd(), 'public', existingImagePath);
                  }
                  
                  // Check if the existing image file exists
                  try {
                    await access(existingImagePath);
                  } catch (error) {
                    console.log(`Skipping existing image ${existingImage.filename} - file not accessible`);
                    continue;
                  }
                  
                  const existingImageBuffer = await sharp(existingImagePath).toBuffer();
                  const existingImageFeatures = await ImageMatcher.extractFeatures(existingImageBuffer);
                  
                  // Compare the two images using our OpenCV-like matching
                  const comparisonResult = await ImageMatcher.compareImages(currentImageBuffer, existingImageBuffer);
                  
                  console.log(`Comparing with ${existingImage.filename}: similarity=${comparisonResult.similarity.toFixed(3)}`);
                  
                  // If similarity is high enough, add visual matches from the existing image
                  if (comparisonResult.similarity >= 0.7) {
                    console.log(`High similarity detected with ${existingImage.filename} (${comparisonResult.similarity.toFixed(3)})`);
                    
                    // Add visual matches from the existing image
                    for (const existingVisualMatch of existingImage.analysisResults.visualMatches) {
                      // Check if we already have a similar visual match
                      const existingMatch = visualMatches.find(match => 
                        match.text === existingVisualMatch.text && 
                        match.category === existingVisualMatch.category
                      );
                      
                      if (!existingMatch) {
                        visualMatches.push({
                          text: `${existingVisualMatch.text} (similar to ${existingImage.filename})`,
                          category: existingVisualMatch.category,
                          confidence: Math.min(0.9, existingVisualMatch.confidence * comparisonResult.similarity),
                          boundingBox: existingVisualMatch.boundingBox,
                          annotationId: `similar_${existingImage._id}_${existingVisualMatch.annotationId}`
                        });
                        
                        console.log(`Added similar visual match: ${existingVisualMatch.text} from ${existingImage.filename}`);
                      }
                    }
                  }
                } catch (comparisonError) {
                  console.error(`Error comparing with ${existingImage.filename}:`, comparisonError);
                }
              }
            }
          } catch (comparisonError) {
            console.error('Error in OpenCV-like visual comparison:', comparisonError);
          }
        }
        
        analysisResults.textMatches = textMatches;
        analysisResults.visualMatches = visualMatches;
        console.log('Found text matches:', textMatches.length);
        console.log('Found visual matches:', visualMatches.length);
      }

      // Determine category based on matching segments
      const allMatches = [...analysisResults.textMatches, ...analysisResults.visualMatches];
      if (allMatches.length > 0) {
        // Group by category and find the most common
        const categoryCounts: { [key: string]: number } = {};
        allMatches.forEach((match: any) => {
          categoryCounts[match.category] = (categoryCounts[match.category] || 0) + 1;
        });
        
        const mostCommonCategory = Object.keys(categoryCounts).reduce((a, b) => 
          categoryCounts[a] > categoryCounts[b] ? a : b
        );
        
        analysisResults.category = mostCommonCategory;
        analysisResults.confidence = Math.max(...allMatches.map((s: any) => s.confidence));
      } else {
        analysisResults.category = 'uncategorized';
        analysisResults.confidence = 0;
      }

      console.log('Final analysis results:', {
        category: analysisResults.category,
        confidence: analysisResults.confidence,
        textMatchesCount: analysisResults.textMatches.length,
        visualMatchesCount: analysisResults.visualMatches.length,
        ocrTextLength: analysisResults.ocrText.length,
        detectedObjectsCount: analysisResults.detectedObjects.length
      });

    } catch (visionError) {
      console.error('Vision API error:', visionError);
      // Fallback analysis without OCR
      analysisResults = {
        ocrText: '',
        detectedObjects: [],
        textMatches: [],
        visualMatches: [],
        confidence: 0,
        category: 'uncategorized',
        imageUrl: imageFile.url,
        imageDimensions: imageDimensions
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
    console.log('Image analysis completed successfully');
    return NextResponse.json({ 
      success: true, 
      category: analysisResults.category,
      confidence: analysisResults.confidence,
      analysisResults: analysisResults
    });

  } catch (error) {
    console.error('Image auto-categorize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 