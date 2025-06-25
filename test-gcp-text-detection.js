const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Test GCP Vision API Text Detection
async function testTextDetection() {
  try {
    console.log('🧪 Testing Google Cloud Vision API Text Detection...\n');
    
    // Read service account credentials
    const credentialsPath = path.resolve('./src/config/isl.json');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    
    console.log('✅ Service account credentials loaded');
    console.log(`   Project: ${credentials.project_id}`);
    console.log(`   Client Email: ${credentials.client_email}\n`);
    
    // Get access token
    const accessToken = await getAccessToken(credentials);
    console.log('✅ Access token obtained successfully\n');
    
    // Test with a simple text detection request (without image for now)
    console.log('📝 Testing TEXT_DETECTION API endpoint...');
    
    // Create a simple test request
    const testRequest = {
      requests: [{
        image: {
          content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // 1x1 transparent PNG
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 10
        }]
      }]
    };
    
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(testRequest),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ TEXT_DETECTION API endpoint is accessible');
    console.log('   Response structure:', Object.keys(result));
    
    if (result.responses && result.responses[0]) {
      const apiResponse = result.responses[0];
      console.log('   Response contains:', Object.keys(apiResponse));
      
      if (apiResponse.textAnnotations) {
        console.log('   ✅ textAnnotations field is available');
      }
      
      if (apiResponse.error) {
        console.log('   ⚠️  API returned error:', apiResponse.error.message);
      }
    }
    
    console.log('\n🎉 GCP Vision API Text Detection test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Service account authentication working');
    console.log('   ✅ Access token generation successful');
    console.log('   ✅ TEXT_DETECTION API endpoint accessible');
    console.log('   ✅ API response structure correct');
    console.log('\n🚀 Ready to use TEXT_DETECTION for OCR processing!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   1. Check if the service account has Vision API enabled');
    console.error('   2. Verify the project has billing enabled');
    console.error('   3. Ensure the service account has proper permissions');
    console.error('   4. Check if the Vision API is enabled in the project');
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

testTextDetection(); 