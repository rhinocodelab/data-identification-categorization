import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';
const COLLECTION = 'audio_annotations';

export async function POST(req: NextRequest) {
  try {
    const { audioId, language, annotations } = await req.json();
    if (!audioId || !language || !Array.isArray(annotations)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION);
    // Upsert by audioId+language
    await collection.updateOne(
      { audioId, language },
      { $set: { audioId, language, annotations, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    await client.close();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 