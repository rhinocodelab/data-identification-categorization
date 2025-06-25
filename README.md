# Data Annotation & Categorization Tool

A comprehensive web application for annotating and auto-categorizing various types of data including images, PDFs, JSON files, and audio files. Built with Next.js, TypeScript, and MongoDB.

## 🚀 Features

### Multi-Format Support
- **Images**: Visual annotation with bounding boxes, OCR text extraction
- **PDFs**: Page-based annotation with text extraction
- **JSON Files**: Key-value pair annotation and validation
- **Audio Files**: Transcript-based annotation with word-level timing

### Annotation Capabilities
- **Visual Annotations**: Draw bounding boxes on images and PDFs
- **Text Annotations**: Extract and annotate OCR text
- **Audio Segment Annotations**: Select and label specific audio segments
- **JSON Key-Value Annotations**: Annotate specific JSON fields
- **Rule-based Categorization**: Create and apply annotation rules

### Auto-Categorization
- **Intelligent File Sorting**: Automatically categorize files based on content analysis
- **Keyword-based Matching**: Use transcript keywords for audio categorization
- **Visual Similarity**: Compare images using OCR text and visual features
- **JSON Pattern Matching**: Match JSON structures and key-value pairs

### Advanced Features
- **Google Cloud Integration**: Speech-to-Text for audio transcription
- **Real-time Preview**: Live preview of annotations and categorization results
- **Export/Import**: Save and load annotation data
- **Category Management**: Create and manage custom categories
- **Search & Filter**: Find specific annotations and files

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB
- **Cloud Services**: Google Cloud Speech-to-Text API
- **File Processing**: Canvas API, PDF.js
- **UI Components**: Lucide React Icons, React Hot Toast

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB (local or cloud instance)
- Google Cloud account (for audio transcription)
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd data-annotation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/intellidocs
   GOOGLE_APPLICATION_CREDENTIALS=./src/config/your-credentials.json
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   ```

4. **Set up Google Cloud credentials**
   - Create a Google Cloud project
   - Enable the Speech-to-Text API
   - Create a service account and download the JSON credentials
   - Place the credentials file in `src/config/`

5. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database named `intellidocs`
   - The application will automatically create required collections

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
data-annotation/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── annotations/   # Annotation CRUD operations
│   │   │   ├── audio/         # Audio transcription
│   │   │   ├── auto-categorize/ # Auto-categorization
│   │   │   └── categories/    # Category management
│   │   ├── annotate/          # Annotation pages
│   │   └── auto-categorize/   # Auto-categorization page
│   ├── components/            # React components
│   │   ├── AnnotationList.tsx # Annotation sidebar
│   │   ├── AudioViewer.tsx    # Audio annotation interface
│   │   ├── CategorySelector.tsx # Category selection
│   │   └── ...
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── public/                    # Static files
│   ├── data/                  # Sample data files
│   └── auto-categorized/      # Auto-categorized files
└── package.json
```

## 🎯 Usage

### Basic Annotation Workflow

1. **Upload Files**
   - Navigate to the annotation page
   - Upload images, PDFs, JSON files, or audio files
   - Files are automatically processed and displayed

2. **Create Annotations**
   - **Images/PDFs**: Draw bounding boxes around areas of interest
   - **Audio**: Select words/phrases from the transcript
   - **JSON**: Click on key-value pairs to annotate
   - Add labels and categories to your annotations

3. **Save Annotations**
   - Click "Save" to store annotations in the database
   - Annotations are linked to the original file

### Auto-Categorization

1. **Upload Files for Categorization**
   - Go to the Auto-Categorize page
   - Upload files to be automatically categorized
   - The system analyzes content and assigns categories

2. **Review Results**
   - View categorization confidence scores
   - See matching segments and keywords
   - For audio files, view transcript and playback

### Category Management

1. **Create Categories**
   - Use the category selector to create new categories
   - Define category names and descriptions

2. **Apply Rules**
   - Create annotation rules for automatic categorization
   - Rules can be based on text, visual features, or patterns

## 🔌 API Endpoints

### Annotations
- `POST /api/annotations/save` - Save annotations
- `GET /api/annotations/load/[dataId]` - Load annotations for a file
- `DELETE /api/annotations/delete/[id]` - Delete an annotation

### Audio Processing
- `POST /api/audio/transcribe` - Transcribe audio files
- `GET /api/audio/metadata` - Get audio file metadata

### Auto-Categorization
- `POST /api/auto-categorize` - Categorize uploaded files
- `POST /api/auto-categorize-upload` - Upload files for categorization

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create a new category

## 🎨 Customization

### Adding New File Types

1. **Update Type Definitions**
   - Add new file types to `src/types/annotation.ts`
   - Define annotation interfaces for the new type

2. **Create Processing Logic**
   - Add file processing in the appropriate API routes
   - Implement annotation extraction and storage

3. **Update UI Components**
   - Create viewer components for the new file type
   - Update the annotation interface

### Custom Categorization Rules

1. **Modify Auto-Categorization Logic**
   - Update `src/app/api/auto-categorize/route.ts`
   - Add custom keyword matching and pattern recognition

2. **Enhance Analysis**
   - Integrate additional ML models
   - Add custom similarity algorithms

## 🐛 Troubleshooting

### Common Issues

1. **Audio Transcription Fails**
   - Verify Google Cloud credentials are correct
   - Check that Speech-to-Text API is enabled
   - Ensure audio file format is supported

2. **MongoDB Connection Issues**
   - Verify MongoDB is running
   - Check connection string in environment variables
   - Ensure database permissions are correct

3. **File Upload Problems**
   - Check file size limits
   - Verify supported file formats
   - Ensure upload directory has write permissions

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

## 📊 Data Storage

### MongoDB Collections

- `annotation` - Stores annotation data and metadata
- `category` - Stores category definitions
- `metadata` - Stores file metadata and processing results

### File Storage

- Original files: `public/data/`
- Auto-categorized files: `public/auto-categorized/`
- Temporary uploads: `public/auto-categorized/auto-upload-temp/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Cloud Speech-to-Text API for audio transcription
- Next.js team for the excellent framework
- MongoDB for the database solution
- The open-source community for various libraries and tools

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for efficient data annotation and categorization**
