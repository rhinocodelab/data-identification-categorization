const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Test GCP Vision API Text Detection with real image
async function testRealOCR() {
  try {
    console.log('🧪 Testing Google Cloud Vision API Text Detection with real image...\n');
    
    // Read service account credentials
    const credentialsPath = path.resolve('./src/config/isl.json');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    
    console.log('✅ Service account credentials loaded');
    
    // Get access token
    const accessToken = await getAccessToken(credentials);
    console.log('✅ Access token obtained successfully\n');
    
    // Read the actual image file
    const imagePath = './public/data/images/1750759612664.png';
    console.log(`📸 Reading image: ${imagePath}`);
    
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`✅ Image loaded: ${imageBuffer.length} bytes\n`);
    
    // Test TEXT_DETECTION on the entire image
    console.log('🔍 Performing TEXT_DETECTION on entire image...');
    const fullImageText = await performOCRWithGCP(accessToken, base64Image);
    console.log(`📝 Full image text: "${fullImageText}"\n`);
    
    // Test TEXT_DETECTION with bounding box (simulating annotation region)
    console.log('🔍 Performing TEXT_DETECTION with bounding box...');
    const boundingBox = { x1: 100, y1: 100, x2: 500, y2: 200 }; // Example bounding box
    const regionText = await performOCRWithGCP(accessToken, base64Image, boundingBox);
    console.log(`📝 Region text (bbox ${boundingBox.x1},${boundingBox.y1} to ${boundingBox.x2},${boundingBox.y2}): "${regionText}"\n`);
    
    console.log('🎉 Real OCR test completed successfully!');
    console.log('\n📋 Results:');
    console.log(`   Full image text length: ${fullImageText.length} characters`);
    console.log(`   Region text length: ${regionText.length} characters`);
    console.log(`   Text detected: ${fullImageText.length > 0 ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Helper function to perform OCR with GCP Vision API
async function performOCRWithGCP(accessToken, base64Image, boundingBox = null) {
  // Prepare the request payload for TEXT_DETECTION
  const requestBody = {
    requests: [{
      image: {
        content: base64Image
      },
      features: [{
        type: 'TEXT_DETECTION',
        maxResults: 10
      }]
    }]
  };

  // If bounding box is provided, add it to the request
  if (boundingBox) {
    console.log(`   Applying bounding box: x1=${boundingBox.x1}, y1=${boundingBox.y1}, x2=${boundingBox.x2}, y2=${boundingBox.y2}`);
    requestBody.requests[0].boundingPoly = {
      vertices: [
        { x: Math.round(boundingBox.x1), y: Math.round(boundingBox.y1) },
        { x: Math.round(boundingBox.x2), y: Math.round(boundingBox.y1) },
        { x: Math.round(boundingBox.x2), y: Math.round(boundingBox.y2) },
        { x: Math.round(boundingBox.x1), y: Math.round(boundingBox.y2) }
      ]
    };
  }

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
  if (result.responses && result.responses[0]) {
    const apiResponse = result.responses[0];
    
    // Check for text annotations
    if (apiResponse.textAnnotations && apiResponse.textAnnotations.length > 0) {
      // The first textAnnotation contains the full text
      const fullText = apiResponse.textAnnotations[0].description || '';
      return fullText;
    }
    
    // Check for error in the response
    if (apiResponse.error) {
      throw new Error(`GCP Vision API error: ${apiResponse.error.message || 'Unknown error'}`);
    }
    
    return '';
  }
  
  return '';
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

testRealOCR(); 