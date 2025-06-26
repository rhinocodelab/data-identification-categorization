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
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Tag as TagIcon, TrendingUp as TrendingUpIcon, Database } from 'lucide-react';

interface CategoryData {
  categoryCounts: Array<{ name: string; count: number; volume: number }>;
  topCategories: Array<{ name: string; count: number; trend: number }>;
  categoryTrends: Array<{ date: string; category: string; count: number }>;
}

interface CategoryInsightsProps {
  data: CategoryData;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];

export default function CategoryInsights({ data }: CategoryInsightsProps) {
  // Prepare data for pie chart
  const pieData = data.categoryCounts.slice(0, 8).map((item, index) => ({
    name: item.name,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  // Prepare data for trend chart
  const trendData = data.categoryTrends.reduce((acc, item) => {
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
        <TagIcon className="h-5 w-5 mr-2 text-green-600" />
        Category Insights
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Distribution */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Database className="h-4 w-4 mr-2 text-blue-600" />
            Category Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Categories */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUpIcon className="h-4 w-4 mr-2 text-purple-600" />
            Top Categories by Usage
          </h3>
          <div className="space-y-3">
            {data.topCategories.slice(0, 8).map((category, index) => (
              <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-900">{category.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{category.count} files</div>
                  <div className={`text-xs ${category.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {category.trend > 0 ? '+' : ''}{category.trend}% from last period
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Trends Over Time */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUpIcon className="h-4 w-4 mr-2 text-indigo-600" />
          Category Usage Trends
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              {data.categoryCounts.slice(0, 5).map((category, index) => (
                <Line
                  key={category.name}
                  type="monotone"
                  dataKey={category.name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Volume by Category */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Database className="h-4 w-4 mr-2 text-orange-600" />
          Data Volume by Category
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categoryCounts.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} MB`, 'Volume']} />
              <Bar dataKey="volume" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
} 