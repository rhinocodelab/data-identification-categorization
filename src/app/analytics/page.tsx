'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as BarResponsiveContainer } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<{ totalFiles: number; totalAnnotations: number; totalCategories: number } | null>(null);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [annotationsPerCategory, setAnnotationsPerCategory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/analytics');
        const result = await res.json();
        if (result.success) {
          setAnalytics(result.data);
          setAnnotationsPerCategory(result.data.annotationsPerCategory || []);
        } else {
          setError(result.error || 'Failed to fetch analytics');
        }
      } catch (err) {
        setError('Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  useEffect(() => {
    // Fetch category breakdown (number of files per category)
    const fetchCategoryBreakdown = async () => {
      try {
        const res = await fetch('/api/categories');
        const result = await res.json();
        if (result.success) {
          // Each category: { id, name, ... }
          // For demo, just count categories (real: count files/annotations per category)
          setCategoryData(result.data.map((cat: any, idx: number) => ({
            name: cat.name,
            value: 1, // Placeholder: 1 per category
            color: cat.color || COLORS[idx % COLORS.length],
          })));
        }
      } catch {}
    };
    fetchCategoryBreakdown();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <Breadcrumb items={[{ label: 'Analytics' }]} />
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading analytics...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-12">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <span className="text-4xl font-bold text-blue-700">{analytics?.totalFiles ?? '--'}</span>
              <span className="text-sm text-gray-500 mt-2">Total Files</span>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <span className="text-4xl font-bold text-green-700">{analytics?.totalAnnotations ?? '--'}</span>
              <span className="text-sm text-gray-500 mt-2">Total Annotations</span>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <span className="text-4xl font-bold text-purple-700">{analytics?.totalCategories ?? '--'}</span>
              <span className="text-sm text-gray-500 mt-2">Categories</span>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Category Breakdown</h2>
          {categoryData.length === 0 ? (
            <div className="text-gray-500 text-sm">No categories found.</div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color || COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Annotations per Category</h2>
          {annotationsPerCategory.length === 0 ? (
            <div className="text-gray-500 text-sm">No annotation data found.</div>
          ) : (
            <div className="w-full h-72">
              <BarResponsiveContainer width="100%" height="100%">
                <BarChart data={annotationsPerCategory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="categoryName" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </BarResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 