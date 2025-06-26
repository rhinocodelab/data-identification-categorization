import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellidocs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    console.log('Analytics API called with timeRange:', timeRange);
    
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    
    // Calculate date range
    const now = new Date();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    // Get collections with correct names
    const annotationsCollection = db.collection('annotation');
    const categoriesCollection = db.collection('category');
    
    console.log('Collections initialized');
    
    // Overview Dashboard Data
    const totalFiles = await annotationsCollection.countDocuments();
    console.log('Total files:', totalFiles);
    
    const totalCategories = await categoriesCollection.countDocuments();
    console.log('Total categories:', totalCategories);
    
    // Files by type
    const filesByType = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('Files by type:', filesByType);
    
    const filesByTypeMap = filesByType.reduce((acc: { [key: string]: number }, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    
    // Auto-categorized files (files with category assigned)
    const autoCategorizedFiles = await annotationsCollection.countDocuments({
      'rule.categoryId': { $exists: true, $ne: null }
    });
    console.log('Auto-categorized files:', autoCategorizedFiles);
    
    // Activity in last 7 and 30 days
    const last7DaysActivity = await annotationsCollection.countDocuments({
      createdAt: { $gte: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) }
    });
    
    const last30DaysActivity = await annotationsCollection.countDocuments({
      createdAt: { $gte: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) }
    });
    
    console.log('Activity - 7 days:', last7DaysActivity, '30 days:', last30DaysActivity);
    
    // Category Insights - Get category names from categories collection
    const categories = await categoriesCollection.find({}).toArray();
    console.log('Categories found:', categories.length);
    
    const categoryMap = categories.reduce((acc: { [key: string]: any }, cat: any) => {
      acc[cat.id] = cat;
      return acc;
    }, {});
    
    // Simplified category counts
    const categoryCounts = await annotationsCollection.aggregate([
      {
        $match: {
          'rule.categoryId': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$rule.categoryId',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          count: 1,
          volume: { $multiply: ['$count', 1] } // Mock volume data
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('Category counts:', categoryCounts);
    
    // Map category IDs to names
    const categoryCountsWithNames = categoryCounts.map((cat: any) => ({
      name: categoryMap[cat.name]?.name || 'Unknown Category',
      count: cat.count,
      volume: cat.volume
    }));
    
    // Top categories with trend (simplified - comparing current period vs previous)
    const topCategories = categoryCountsWithNames.slice(0, 8).map((cat: any) => ({
      name: cat.name,
      count: cat.count,
      trend: Math.floor(Math.random() * 20) - 10 // Mock trend data for now
    }));
    
    // Category trends over time
    const categoryTrends = await annotationsCollection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          'rule.categoryId': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            categoryId: '$rule.categoryId'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id.date',
          category: '$_id.categoryId',
          count: 1
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();
    
    // Map category IDs to names in trends
    const categoryTrendsWithNames = categoryTrends.map((trend: any) => ({
      date: trend.date,
      category: categoryMap[trend.category]?.name || 'Unknown Category',
      count: trend.count
    }));
    
    console.log('Category trends:', categoryTrendsWithNames.length);
    
    // Rule Effectiveness - Analyze actual rules from annotations
    const ruleStats = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$rule.ruleName',
          totalFiles: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          matches: '$totalFiles',
          accuracy: 85 // Mock accuracy for now
        }
      },
      { $sort: { matches: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('Rule stats:', ruleStats.length);
    
    const topPerforming = ruleStats.slice(0, 5).map((rule: any) => ({
      name: rule.name || 'Unnamed Rule',
      matches: rule.matches,
      accuracy: rule.accuracy
    }));
    
    const mostMisses = ruleStats.slice(5, 10).map((rule: any) => ({
      name: rule.name || 'Unnamed Rule',
      misses: Math.floor(rule.matches * 0.3), // Mock miss data
      uncategorized: Math.floor(rule.matches * 0.2) // Mock uncategorized data
    }));
    
    // Unused rules (rules not used in recent period)
    const unusedRules = await annotationsCollection.aggregate([
      {
        $match: {
          createdAt: { $lt: startDate }
        }
      },
      {
        $group: {
          _id: '$rule.ruleName',
          lastUsed: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          name: '$_id',
          lastUsed: { $dateToString: { format: '%Y-%m-%d', date: '$lastUsed' } },
          daysUnused: { 
            $floor: { 
              $divide: [
                { $subtract: [new Date(), '$lastUsed'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      { $sort: { daysUnused: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    console.log('Unused rules:', unusedRules.length);
    
    // Data Type Distribution
    const dataTypeDistribution = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          percentage: { $multiply: [{ $divide: ['$count', totalFiles] }, 100] }
        }
      }
    ]).toArray();
    
    console.log('Data type distribution:', dataTypeDistribution);
    
    // Success rates by file type (based on categorization)
    const successRates = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          totalFiles: { $sum: 1 },
          categorizedFiles: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$rule.categoryId', null] }, { $ne: ['$rule.categoryId', ''] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          type: '$_id',
          totalFiles: 1,
          successRate: { $multiply: [{ $divide: ['$categorizedFiles', '$totalFiles'] }, 100] }
        }
      }
    ]).toArray();
    
    console.log('Success rates:', successRates);
    
    // Annotation coverage (based on actual annotations)
    const annotationCoverage = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          totalFiles: { $sum: 1 },
          filesWithAnnotations: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$annotations', null] }, { $gt: [{ $size: '$annotations' }, 0] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          type: '$_id',
          totalFiles: 1,
          coverage: { $multiply: [{ $divide: ['$filesWithAnnotations', '$totalFiles'] }, 100] },
          totalRules: 5 // Mock total rules
        }
      }
    ]).toArray();
    
    console.log('Annotation coverage:', annotationCoverage);
    
    // Annotation Statistics
    const annotationsByDataType = await annotationsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: { $size: { $ifNull: ['$annotations', []] } } }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1
        }
      }
    ]).toArray();
    
    console.log('Annotations by data type:', annotationsByDataType);
    
    // Keywords (extract from annotations)
    const keywords = await annotationsCollection.aggregate([
      {
        $match: {
          annotations: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: '$annotations'
      },
      {
        $group: {
          _id: {
            $toLower: {
              $cond: [
                { $ifNull: ['$annotations.label', false] },
                '$annotations.label',
                '$annotations.text'
              ]
            }
          },
          frequency: { $sum: 1 }
        }
      },
      {
        $project: {
          keyword: '$_id',
          frequency: 1
        }
      },
      { $sort: { frequency: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    console.log('Keywords found:', keywords.length);
    
    // Bounding boxes (for image annotations)
    const boundingBoxes = await annotationsCollection.aggregate([
      {
        $match: {
          type: 'image',
          'annotations.boundingBox': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$rule.categoryId',
          count: { $sum: { $size: '$annotations' } }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1
        }
      }
    ]).toArray();
    
    // Map category IDs to names in bounding boxes
    const boundingBoxesWithNames = boundingBoxes.map((box: any) => ({
      type: categoryMap[box.type]?.name || 'Unknown Category',
      count: box.count
    }));
    
    console.log('Bounding boxes:', boundingBoxesWithNames.length);
    
    // Annotation activity over time
    const annotationActivity = await annotationsCollection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            categoryId: '$rule.categoryId'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id.date',
          category: '$_id.categoryId',
          count: 1
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();
    
    // Map category IDs to names in activity
    const annotationActivityWithNames = annotationActivity.map((activity: any) => ({
      date: activity.date,
      category: categoryMap[activity.category]?.name || 'Uncategorized',
      count: activity.count
    }));
    
    console.log('Annotation activity:', annotationActivityWithNames.length);
    
    await client.close();
    console.log('MongoDB connection closed');
    
    const analyticsData = {
      overview: {
        totalFiles,
        filesByType: filesByTypeMap,
        totalCategories,
        totalRules: ruleStats.length,
        autoCategorizedFiles,
        last7DaysActivity,
        last30DaysActivity
      },
      categories: {
        categoryCounts: categoryCountsWithNames,
        topCategories,
        categoryTrends: categoryTrendsWithNames
      },
      rules: {
        topPerforming,
        mostMisses,
        unusedRules
      },
      dataTypes: {
        distribution: dataTypeDistribution,
        successRates,
        annotationCoverage
      },
      annotations: {
        byDataType: annotationsByDataType,
        keywords,
        boundingBoxes: boundingBoxesWithNames,
        activityOverTime: annotationActivityWithNames
      }
    };
    
    console.log('Analytics data prepared successfully');
    return NextResponse.json(analyticsData);
    
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 