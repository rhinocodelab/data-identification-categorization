'use client';

import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Tag, MessageSquare, Square, TrendingUp } from 'lucide-react';

interface AnnotationData {
  byDataType: Array<{ type: string; count: number }>;
  keywords: Array<{ keyword: string; frequency: number }>;
  boundingBoxes: Array<{ type: string; count: number }>;
  activityOverTime: Array<{ date: string; count: number; category: string }>;
}

interface AnnotationStatisticsProps {
  data: AnnotationData;
}

export default function AnnotationStatistics({ data }: AnnotationStatisticsProps) {
  // Prepare data for activity over time chart
  const activityData = data.activityOverTime.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      existing[item.category] = item.count;
    } else {
      acc.push({ date: item.date, [item.category]: item.count });
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 flex items-center">
        <Tag className="h-5 w-5 mr-2 text-indigo-600" />
        Annotation Statistics
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Annotations by Data Type */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
            Annotations by Data Type
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDataType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Common Keywords */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Tag className="h-4 w-4 mr-2 text-green-600" />
            Most Common Keywords
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.keywords.slice(0, 10).map((keyword, index) => (
              <div key={keyword.keyword} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{index + 1}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{keyword.keyword}</span>
                </div>
                <span className="text-sm font-bold text-blue-600">{keyword.frequency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bounding Boxes Count */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Square className="h-4 w-4 mr-2 text-purple-600" />
          Bounding Boxes by Type
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.boundingBoxes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annotation Activity Over Time */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-orange-600" />
          Annotation Activity Over Time
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              {data.byDataType.slice(0, 5).map((type, index) => (
                <Line
                  key={type.type}
                  type="monotone"
                  dataKey={type.type}
                  stroke={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">
            {data.byDataType.reduce((sum, item) => sum + item.count, 0)}
          </div>
          <div className="text-sm text-blue-700">Total Annotations</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">
            {data.keywords.length}
          </div>
          <div className="text-sm text-green-700">Unique Keywords</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">
            {data.boundingBoxes.reduce((sum, item) => sum + item.count, 0)}
          </div>
          <div className="text-sm text-purple-700">Total Bounding Boxes</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-2xl font-bold text-orange-900">
            {data.byDataType.length}
          </div>
          <div className="text-sm text-orange-700">Data Types with Annotations</div>
        </div>
      </div>
    </div>
  );
} 