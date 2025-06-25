const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const ANNOTATION_COLLECTION = 'annotation';
const CATEGORY_COLLECTION = 'category';

// Helper function to simulate OCR (fallback when GCP Vision API is not available)
function simulateOCR(boundingBox) {
  if (boundingBox) {
    const area = (boundingBox.x2 - boundingBox.x1) * (boundingBox.y2 - boundingBox.y1);
    if (area > 1000) {
      return 'simulated ocr text';
    } else {
      return '';
    }
  }
  return '';
}

// Helper function to perform real OCR with Google Cloud Vision API
async function performOCRWithGCP(imagePath, boundingBox) {
  try {
    // Read service account credentials
    const credentialsPath = path.resolve('./src/config/isl.json');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    
    // Read the image file
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Prepare the request payload
    const requestBody = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 1
        }]
      }]
    };

    // If bounding box is provided, add it to the request
    if (boundingBox) {
      requestBody.requests[0].features[0].boundingPoly = {
        vertices: [
          { x: Math.round(boundingBox.x1), y: Math.round(boundingBox.y1) },
          { x: Math.round(boundingBox.x2), y: Math.round(boundingBox.y1) },
          { x: Math.round(boundingBox.x2), y: Math.round(boundingBox.y2) },
          { x: Math.round(boundingBox.x1), y: Math.round(boundingBox.y2) }
        ]
      };
    }

    // Get access token
    const accessToken = await getAccessToken(credentials);

    // Call Google Cloud Vision API
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GCP Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text from the response
    if (result.responses && result.responses[0] && result.responses[0].textAnnotations) {
      return result.responses[0].textAnnotations[0].description || '';
    }
    
    return '';
  } catch (error) {
    console.error('GCP Vision API error:', error);
    // Fallback to simulation
    return simulateOCR(boundingBox);
  }
}

// Helper function to get access token from service account
async function getAccessToken(credentials) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createJWT(credentials),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Helper function to create JWT for service account
function createJWT(credentials) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${encodedHeader}.${encodedPayload}`);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Helper function to calculate text similarity (simple implementation)
function calculateTextSimilarity(text1, text2) {
  if (text1 === text2) return 1.0;
  
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
}

// Helper function to calculate bounding box similarity
function calculateBoundingBoxSimilarity(bbox1, bbox2) {
  // Calculate overlap area
  const xOverlap = Math.max(0, Math.min(bbox1.x2, bbox2.x2) - Math.max(bbox1.x1, bbox2.x1));
  const yOverlap = Math.max(0, Math.min(bbox1.y2, bbox2.y2) - Math.max(bbox1.y1, bbox2.y1));
  const overlapArea = xOverlap * yOverlap;
  
  // Calculate areas
  const area1 = (bbox1.x2 - bbox1.x1) * (bbox1.y2 - bbox1.y1);
  const area2 = (bbox2.x2 - bbox2.x1) * (bbox2.y2 - bbox2.y1);
  const unionArea = area1 + area2 - overlapArea;
  
  return unionArea > 0 ? overlapArea / unionArea : 0;
}

async function testAutoCategorize() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const annotationCollection = db.collection(ANNOTATION_COLLECTION);
    const categoryCollection = db.collection(CATEGORY_COLLECTION);

    // Get all categories
    const categories = await categoryCollection.find({}).toArray();
    console.log('Found categories:', categories.length);

    // Find annotations that match image type
    const matchingAnnotations = await annotationCollection.find({
      'type': 'image'
    }).toArray();

    console.log('Found annotations with matching type:', matchingAnnotations.length);

    if (matchingAnnotations.length === 0) {
      console.log('No annotation rules found for image files.');
      return;
    }

    // Test with different OCR texts
    const testCases = [
      { name: 'Exact match', ocrText: 'Excessive data extraction' },
      { name: 'Partial match', ocrText: 'Excessive data' },
      { name: 'No match', ocrText: 'Completely different text' },
      { name: 'Empty text', ocrText: '' }
    ];

    for (const testCase of testCases) {
      console.log(`\n=== Testing: ${testCase.name} ===`);
      console.log(`OCR Text: "${testCase.ocrText}"`);
      
      let bestMatch = null;
      let bestScore = 0;
      let bestMatchHasTextSimilarity = false;

      // For each matching annotation, compare OCR text and bounding boxes
      for (const annotation of matchingAnnotations) {
        let annotationScore = 0;
        let hasTextSimilarity = false;
        
        console.log(`\nEvaluating annotation: ${annotation.dataId} (${annotation.rule?.ruleName})`);
        
        // Compare OCR text if available
        if (annotation.annotations && annotation.annotations.length > 0) {
          for (const ann of annotation.annotations) {
            if (ann.ocrText) {
              // Use real OCR extraction from the bounding box
              // For testing, we'll use a sample image path - you would need to provide a real image
              const sampleImagePath = './public/images/sample.png'; // This would be a real image path
              
              try {
                const extractedText = await performOCRWithGCP(sampleImagePath, {
                  x1: ann.x1,
                  y1: ann.y1,
                  x2: ann.x2,
                  y2: ann.y2
                });
                
                console.log(`OCR comparison: Extracted "${extractedText}" vs stored "${ann.ocrText}"`);
                
                // Calculate text similarity - this is now 100% of the score
                const similarity = calculateTextSimilarity(extractedText.toLowerCase(), ann.ocrText.toLowerCase());
                annotationScore = similarity; // Use text similarity as the full score
                
                if (similarity > 0) {
                  hasTextSimilarity = true;
                }
                
                console.log(`Text similarity: ${similarity} (full score: ${annotationScore})`);
              } catch (error) {
                console.log(`OCR failed, using fallback: ${error.message}`);
                // Fallback to simulation for testing
                const extractedText = simulateOCR({
                  x1: ann.x1,
                  y1: ann.y1,
                  x2: ann.x2,
                  y2: ann.y2
                });
                
                console.log(`Fallback OCR: Extracted "${extractedText}" vs stored "${ann.ocrText}"`);
                
                const similarity = calculateTextSimilarity(extractedText.toLowerCase(), ann.ocrText.toLowerCase());
                annotationScore = similarity;
                
                if (similarity > 0) {
                  hasTextSimilarity = true;
                }
                
                console.log(`Text similarity: ${similarity} (full score: ${annotationScore})`);
              }
            }
          }
        }
        
        console.log(`Total score for ${annotation.dataId}: ${annotationScore}`);
        
        if (annotationScore > bestScore) {
          bestScore = annotationScore;
          bestMatch = annotation;
          bestMatchHasTextSimilarity = hasTextSimilarity;
        }
      }
      
      // Check if the best match score is above threshold
      const MIN_SCORE_THRESHOLD = 0.5; // Higher threshold for text-only matching
      console.log(`\nBest score: ${bestScore} (threshold: ${MIN_SCORE_THRESHOLD})`);
      console.log(`Has text similarity: ${bestMatchHasTextSimilarity}`);
      
      if (bestScore < MIN_SCORE_THRESHOLD || !bestMatchHasTextSimilarity) {
        console.log('❌ Result: UN-IDENTIFIED DATA');
        if (!bestMatchHasTextSimilarity) {
          console.log('   Reason: No text similarity found');
        } else {
          console.log('   Reason: Score below threshold');
        }
      } else {
        const matchedCategory = categories.find(cat => cat.id === bestMatch.rule.categoryId);
        console.log(`✅ Result: Categorized as ${matchedCategory?.name || 'Unknown'}`);
      }
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await client.close();
  }
}

testAutoCategorize(); 