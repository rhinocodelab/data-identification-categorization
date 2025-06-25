import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const ANNOTATION_COLLECTION = 'annotation';
const CATEGORY_COLLECTION = 'category';

export async function GET() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    // Count annotations and categories from MongoDB
    const totalAnnotations = await db.collection(ANNOTATION_COLLECTION).countDocuments();
    const totalCategories = await db.collection(CATEGORY_COLLECTION).countDocuments();

    // Count files from metadata.json files
    const imagesMetaPath = path.join(process.cwd(), 'public', 'data', 'images', 'metadata.json');
    const pdfsMetaPath = path.join(process.cwd(), 'public', 'data', 'pdfs', 'metadata.json');
    let totalFiles = 0;
    try {
      const imagesMeta = JSON.parse(await readFile(imagesMetaPath, 'utf-8'));
      totalFiles += Array.isArray(imagesMeta) ? imagesMeta.length : 0;
    } catch {}
    try {
      const pdfsMeta = JSON.parse(await readFile(pdfsMetaPath, 'utf-8'));
      totalFiles += Array.isArray(pdfsMeta) ? pdfsMeta.length : 0;
    } catch {}

    // Annotations per category
    const categories = await db.collection(CATEGORY_COLLECTION).find({}).toArray();
    const annotationsPerCategory = [];
    for (const cat of categories) {
      const count = await db.collection(ANNOTATION_COLLECTION).countDocuments({ 'rule.categoryId': cat.id });
      annotationsPerCategory.push({ categoryName: cat.name, count });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalFiles,
        totalAnnotations,
        totalCategories,
        annotationsPerCategory,
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  } finally {
    await client.close();
  }
} 