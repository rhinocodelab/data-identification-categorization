'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  FileText, 
  Image, 
  FileAudio, 
  FileJson, 
  File,
  Users,
  Target,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Tag,
  Layers
} from 'lucide-react';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import OverviewDashboard from '@/components/analytics/OverviewDashboard';
import CategoryInsights from '@/components/analytics/CategoryInsights';
import RuleEffectiveness from '@/components/analytics/RuleEffectiveness';
import DataTypeDistribution from '@/components/analytics/DataTypeDistribution';
import AnnotationStatistics from '@/components/analytics/AnnotationStatistics';

interface AnalyticsData {
  overview: {
    totalFiles: number;
    filesByType: { [key: string]: number };
    totalCategories: number;
    totalRules: number;
    autoCategorizedFiles: number;
    last7DaysActivity: number;
    last30DaysActivity: number;
  };
  categories: {
    categoryCounts: Array<{ name: string; count: number; volume: number }>;
    topCategories: Array<{ name: string; count: number; trend: number }>;
    categoryTrends: Array<{ date: string; category: string; count: number }>;
  };
  rules: {
    topPerforming: Array<{ name: string; matches: number; accuracy: number }>;
    mostMisses: Array<{ name: string; misses: number; uncategorized: number }>;
    unusedRules: Array<{ name: string; lastUsed: string; daysUnused: number }>;
  };
  dataTypes: {
    distribution: Array<{ type: string; count: number; percentage: number }>;
    successRates: Array<{ type: string; successRate: number; totalFiles: number }>;
    annotationCoverage: Array<{ type: string; coverage: number; totalRules: number }>;
  };
  annotations: {
    byDataType: Array<{ type: string; count: number }>;
    keywords: Array<{ keyword: string; frequency: number }>;
    boundingBoxes: Array<{ type: string; count: number }>;
    activityOverTime: Array<{ date: string; count: number; category: string }>;
  };
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
          <Breadcrumb items={[{ label: 'Analytics' }]} />
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
          <Breadcrumb items={[{ label: 'Analytics' }]} />
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
              <p className="text-red-600 mb-2">Error loading analytics</p>
              <p className="text-gray-600 text-sm">{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 max-w-8xl mx-auto px-4 py-8 w-full">
        <Breadcrumb items={[{ label: 'Analytics' }]} />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <BarChart3 className="h-8 w-8 mr-3 text-blue-600" />
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Comprehensive insights into your data annotation and categorization activities
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Time Range:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        {analyticsData && (
          <div className="space-y-8">
            {/* Overview Dashboard */}
            <OverviewDashboard data={analyticsData.overview} />
            
            {/* Category Insights */}
            <CategoryInsights data={analyticsData.categories} />
            
            {/* Rule Effectiveness */}
            <RuleEffectiveness data={analyticsData.rules} />
            
            {/* Data Type Distribution */}
            <DataTypeDistribution data={analyticsData.dataTypes} />
            
            {/* Annotation Statistics */}
            <AnnotationStatistics data={analyticsData.annotations} />
          </div>
        )}
      </div>
    </div>
  );
} 