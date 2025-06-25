const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Read service account credentials
async function testGCPAuth() {
  try {
    const credentialsPath = path.resolve('./src/config/isl.json');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    
    console.log('Service account credentials loaded successfully');
    console.log('Project ID:', credentials.project_id);
    console.log('Client Email:', credentials.client_email);
    
    // Test JWT creation
    const jwt = createJWT(credentials);
    console.log('JWT created successfully (first 50 chars):', jwt.substring(0, 50) + '...');
    
    // Test access token request
    const accessToken = await getAccessToken(credentials);
    console.log('Access token obtained successfully (first 20 chars):', accessToken.substring(0, 20) + '...');
    
    console.log('✅ Google Cloud authentication test passed!');
    
  } catch (error) {
    console.error('❌ Google Cloud authentication test failed:', error.message);
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

testGCPAuth(); 