'use client';

import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Target as TargetIcon, CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, AlertCircle as AlertCircleIcon, TrendingUp } from 'lucide-react';

interface RuleData {
  topPerforming: Array<{ name: string; matches: number; accuracy: number }>;
  mostMisses: Array<{ name: string; misses: number; uncategorized: number }>;
  unusedRules: Array<{ name: string; lastUsed: string; daysUnused: number }>;
}

interface RuleEffectivenessProps {
  data: RuleData;
}

export default function RuleEffectiveness({ data }: RuleEffectivenessProps) {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 flex items-center">
        <TargetIcon className="h-5 w-5 mr-2 text-purple-600" />
        Rule Effectiveness
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Performing Rules */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-green-900 flex items-center">
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Top Performing
            </h3>
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="space-y-3">
            {data.topPerforming.slice(0, 5).map((rule, index) => (
              <div key={rule.name} className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-900 truncate">{rule.name}</span>
                  <span className="text-xs text-green-600 font-bold">{(rule.accuracy || 0).toFixed(1)}%</span>
                </div>
                <div className="text-xs text-green-700">{(rule.matches || 0)} successful matches</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules with Most Misses */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-red-900 flex items-center">
              <XCircleIcon className="h-4 w-4 mr-2" />
              Most Misses
            </h3>
            <XCircleIcon className="h-6 w-6 text-red-600" />
          </div>
          <div className="space-y-3">
            {data.mostMisses.slice(0, 5).map((rule, index) => (
              <div key={rule.name} className="bg-white rounded-lg p-3 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-900 truncate">{rule.name}</span>
                  <span className="text-xs text-red-600 font-bold">{rule.misses || 0}</span>
                </div>
                <div className="text-xs text-red-700">{(rule.uncategorized || 0)} uncategorized files</div>
              </div>
            ))}
          </div>
        </div>

        {/* Unused Rules */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-yellow-900 flex items-center">
              <AlertCircleIcon className="h-4 w-4 mr-2" />
              Unused Rules
            </h3>
            <AlertCircleIcon className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="space-y-3">
            {data.unusedRules.slice(0, 5).map((rule, index) => (
              <div key={rule.name} className="bg-white rounded-lg p-3 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-900 truncate">{rule.name}</span>
                  <span className="text-xs text-yellow-600 font-bold">{(rule.daysUnused || 0)}d</span>
                </div>
                <div className="text-xs text-yellow-700">Last used: {rule.lastUsed || 'Unknown'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rule Performance Chart */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
          Rule Performance Overview
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topPerforming.slice(0, 8).map(rule => ({
              ...rule,
              matches: rule.matches || 0,
              accuracy: rule.accuracy || 0
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value, name) => [value, name === 'matches' ? 'Matches' : 'Accuracy %']} />
              <Bar dataKey="matches" fill="#10B981" name="matches" />
              <Bar dataKey="accuracy" fill="#3B82F6" name="accuracy" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">
            {data.topPerforming.length}
          </div>
          <div className="text-sm text-blue-700">Active Rules</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">
            {data.topPerforming.reduce((sum, rule) => sum + (rule.matches || 0), 0)}
          </div>
          <div className="text-sm text-green-700">Total Successful Matches</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">
            {data.mostMisses.reduce((sum, rule) => sum + (rule.misses || 0), 0)}
          </div>
          <div className="text-sm text-red-700">Total Misses</div>
        </div>
      </div>
    </div>
  );
} 