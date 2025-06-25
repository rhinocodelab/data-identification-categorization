import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const COLLECTION_NAME = 'category';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const database = client.db(DATABASE_NAME);
    const categoryCollection = database.collection(COLLECTION_NAME);
    const annotationCollection = database.collection('annotation');

    // Check if category exists
    const category = await categoryCollection.findOne({ id: categoryId });
    if (!category) {
      await client.close();
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category is being used in any annotations
    const annotationsUsingCategory = await annotationCollection.findOne({
      'rule.categoryId': categoryId
    });

    if (annotationsUsingCategory) {
      await client.close();
      return NextResponse.json(
        { error: 'Cannot delete category: it is being used by one or more documents' },
        { status: 409 }
      );
    }

    // Delete the category
    await categoryCollection.deleteOne({ id: categoryId });
    await client.close();

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
} 