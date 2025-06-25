# Google Cloud Vision API Setup for Auto-Categorize

## Prerequisites
1. Google Cloud Platform account
2. A project with Vision API enabled

## Setup Steps

### 1. Enable Vision API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search for "Cloud Vision API"
5. Click on it and press "Enable"

### 2. Create API Key
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key

### 3. Configure Environment Variables
Add your API key to the `.env` file:

```bash
# Add this line to your .env file
GOOGLE_CLOUD_API_KEY=your_actual_api_key_here
```

### 4. Restart the Development Server
```bash
npm run dev
```

## How It Works

The auto-categorize API now:

1. **Receives uploaded image** from `public/auto-categorized/auto-upload-temp/`
2. **Identifies file type** (image/pdf)
3. **Finds matching annotations** in the database with the same `type`
4. **Performs OCR** using Google Cloud Vision API on the uploaded image
5. **Compares extracted text** with stored annotation OCR text
6. **Calculates similarity scores** based on:
   - Text similarity (60% weight)
   - Bounding box similarity (40% weight)
7. **Selects best match** and categorizes the file accordingly

## API Response Example

```json
{
  "success": true,
  "category": "CAT1",
  "destPath": "public/auto-categorized/CAT1/auto-upload-...png",
  "matchedAnnotation": {
    "dataId": "1750759612664.png",
    "ruleName": "Rule1",
    "categoryId": "category-1750759911397-iu7zctj5w"
  }
}
```

## Troubleshooting

- **API Key Error**: Make sure your API key is valid and has Vision API access
- **OCR Failures**: Check that the image contains readable text
- **No Matches**: Ensure you have annotations with the correct `type` field in your database

## Cost Considerations

- Google Cloud Vision API charges per 1000 requests
- Consider implementing caching for repeated images
- Monitor usage in Google Cloud Console 