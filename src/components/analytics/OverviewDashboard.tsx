'use client';

import { 
  Database, 
  Tag, 
  Target, 
  CheckCircle, 
  TrendingUp, 
  Calendar,
  FileText,
  Image,
  FileAudio,
  FileJson,
  File
} from 'lucide-react';

interface OverviewData {
  totalFiles: number;
  filesByType: { [key: string]: number };
  totalCategories: number;
  totalRules: number;
  autoCategorizedFiles: number;
  last7DaysActivity: number;
  last30DaysActivity: number;
}

interface OverviewDashboardProps {
  data: OverviewData;
}

const fileTypeIcons = {
  'image': Image,
  'audio': FileAudio,
  'json': FileJson,
  'pdf': File,
  'text': FileText
};

const fileTypeColors = {
  'image': 'text-blue-600',
  'audio': 'text-purple-600',
  'json': 'text-green-600',
  'pdf': 'text-red-600',
  'text': 'text-orange-600'
};

export default function OverviewDashboard({ data }: OverviewDashboardProps) {
  const getFileTypeIcon = (type: string) => {
    const IconComponent = fileTypeIcons[type as keyof typeof fileTypeIcons] || File;
    return <IconComponent className="h-4 w-4" />;
  };

  const getFileTypeColor = (type: string) => {
    return fileTypeColors[type as keyof typeof fileTypeColors] || 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 flex items-center">
        <Database className="h-5 w-5 mr-2 text-blue-600" />
        Overview Dashboard
      </h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Files */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Files</p>
              <p className="text-2xl font-bold text-blue-900">{data.totalFiles.toLocaleString()}</p>
            </div>
            <Database className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        {/* Total Categories */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Categories</p>
              <p className="text-2xl font-bold text-green-900">{data.totalCategories}</p>
            </div>
            <Tag className="h-8 w-8 text-green-600" />
          </div>
        </div>

        {/* Total Rules */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Rules Created</p>
              <p className="text-2xl font-bold text-purple-900">{data.totalRules}</p>
            </div>
            <Target className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        {/* Auto-Categorized Files */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Auto-Categorized</p>
              <p className="text-2xl font-bold text-orange-900">{data.autoCategorizedFiles}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Activity */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 7 Days</span>
              <span className="text-sm font-medium text-gray-900">{data.last7DaysActivity} files</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 30 Days</span>
              <span className="text-sm font-medium text-gray-900">{data.last30DaysActivity} files</span>
            </div>
          </div>
        </div>

        {/* File Type Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Files by Type
          </h3>
          <div className="space-y-2">
            {Object.entries(data.filesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={getFileTypeColor(type)}>
                    {getFileTypeIcon(type)}
                  </span>
                  <span className="text-sm text-gray-600 capitalize">{type}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Auto-Categorization Success Rate</h3>
            <p className="text-sm text-blue-700">
              {data.totalFiles > 0 
                ? `${((data.autoCategorizedFiles / data.totalFiles) * 100).toFixed(1)}% of files successfully categorized`
                : 'No files processed yet'
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">
              {data.totalFiles > 0 
                ? `${((data.autoCategorizedFiles / data.totalFiles) * 100).toFixed(1)}%`
                : '0%'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 