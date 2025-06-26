'use client';

import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { FileText, Image, FileAudio, FileJson, File, TrendingUp } from 'lucide-react';

interface DataTypeData {
  distribution: Array<{ type: string; count: number; percentage: number }>;
  successRates: Array<{ type: string; successRate: number; totalFiles: number }>;
  annotationCoverage: Array<{ type: string; coverage: number; totalRules: number }>;
}

interface DataTypeDistributionProps {
  data: DataTypeData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const getIconForType = (type: string) => {
  switch (type.toLowerCase()) {
    case 'image':
    case 'images':
      return <Image className="h-4 w-4" />;
    case 'audio':
    case 'audio files':
      return <FileAudio className="h-4 w-4" />;
    case 'pdf':
    case 'documents':
      return <FileText className="h-4 w-4" />;
    case 'json':
    case 'data':
      return <FileJson className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

export default function DataTypeDistribution({ data }: DataTypeDistributionProps) {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 flex items-center">
        <PieChart className="h-5 w-5 mr-2 text-green-600" />
        Data Type Distribution
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart - Distribution */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
            File Type Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, percentage }) => `${type}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, 'Files']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - Success Rates */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">Auto-Categorization Success Rates</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.successRates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value, name) => [value, name === 'successRate' ? 'Success Rate %' : 'Total Files']} />
                <Legend />
                <Bar dataKey="successRate" fill="#10B981" name="Success Rate" />
                <Bar dataKey="totalFiles" fill="#3B82F6" name="Total Files" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Distribution Stats */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-3">File Type Breakdown</h4>
            <div className="space-y-2">
              {data.distribution.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getIconForType(item.type)}
                    <span className="text-sm text-blue-800 ml-2">{item.type}</span>
                  </div>
                  <span className="text-sm font-medium text-blue-900">{item.count} files</span>
                </div>
              ))}
            </div>
          </div>

          {/* Success Rates */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="text-sm font-medium text-green-900 mb-3">Success Rates</h4>
            <div className="space-y-2">
              {data.successRates.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-sm text-green-800">{item.type}</span>
                  <span className="text-sm font-medium text-green-900">{item.successRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Annotation Coverage */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h4 className="text-sm font-medium text-purple-900 mb-3">Annotation Coverage</h4>
            <div className="space-y-2">
              {data.annotationCoverage.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-sm text-purple-800">{item.type}</span>
                  <span className="text-sm font-medium text-purple-900">{item.coverage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">
            {data.distribution.reduce((sum, item) => sum + item.count, 0)}
          </div>
          <div className="text-sm text-blue-700">Total Files</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">
            {data.distribution.length}
          </div>
          <div className="text-sm text-green-700">File Types</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">
            {(data.successRates.reduce((sum, item) => sum + item.successRate, 0) / data.successRates.length).toFixed(1)}%
          </div>
          <div className="text-sm text-purple-700">Avg Success Rate</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-2xl font-bold text-orange-900">
            {(data.annotationCoverage.reduce((sum, item) => sum + item.coverage, 0) / data.annotationCoverage.length).toFixed(1)}%
          </div>
          <div className="text-sm text-orange-700">Avg Coverage</div>
        </div>
      </div>
    </div>
  );
} 