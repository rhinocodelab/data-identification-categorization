'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/types/annotation';
import { Plus, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategorySelectorProps {
  selectedCategoryId?: string;
  onCategoryChange: (categoryId: string | undefined) => void;
  disabled?: boolean;
  categories?: Category[];
}

const predefinedColors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export default function CategorySelector({ 
  selectedCategoryId, 
  onCategoryChange, 
  disabled = false,
  categories: categoriesProp
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>(categoriesProp || []);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(predefinedColors[0]);
  const [loading, setLoading] = useState(false);

  // Load categories from MongoDB API if not provided by prop
  useEffect(() => {
    if (!categoriesProp) {
      const loadCategories = async () => {
        try {
          const response = await fetch('/api/categories');
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setCategories(result.data);
            }
          } else {
            console.error('Failed to load categories');
          }
        } catch (error) {
          console.error('Error loading categories:', error);
        }
      };
      loadCategories();
    } else {
      setCategories(categoriesProp);
    }
  }, [categoriesProp]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || undefined,
          color: selectedColor,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const newCategory = result.data;
          
          // Add the new category to local state
          setCategories(prev => [...prev, newCategory]);
          
          // Auto-select the new category
          onCategoryChange(newCategory.id);
          
          // Reset form
          setNewCategoryName('');
          setNewCategoryDescription('');
          setSelectedColor(predefinedColors[0]);
          setShowCreateForm(false);
          
          toast.success(`Category "${newCategory.name}" created successfully!`);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    if (confirm(`Are you sure you want to delete the category "${category.name}"? This will remove it from all documents.`)) {
      try {
        const response = await fetch(`/api/categories/${categoryId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // Remove from local state
          setCategories(prev => prev.filter(cat => cat.id !== categoryId));
          
          // If the deleted category was selected, clear the selection
          if (selectedCategoryId === categoryId) {
            onCategoryChange(undefined);
          }
          
          toast.success(`Category "${category.name}" deleted successfully!`);
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to delete category');
        }
      } catch (error) {
        console.error('Error deleting category:', error);
        toast.error('Failed to delete category');
      }
    }
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-2 text-gray-900 flex items-center">
          <Tag className="h-5 w-5 mr-2 text-blue-600" />
          Data Category
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={disabled}
          className="flex items-center text-sm text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Category
        </button>
      </div>

      {/* Category Dropdown */}
      <select
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        value={selectedCategoryId || ''}
        onChange={e => onCategoryChange(e.target.value)}
        disabled={disabled || categories.length === 0}
      >
        <option value="" disabled>Select a category</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {/* Create New Category Form */}
      {showCreateForm && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                maxLength={50}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Enter category description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                rows={2}
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color ? 'border-gray-800 scale-110' : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Select ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCategoryName('');
                  setNewCategoryDescription('');
                  setSelectedColor(predefinedColors[0]);
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={loading || !newCategoryName.trim()}
                className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Category Display */}
      {selectedCategory && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedCategory.color }}
            />
            <span className="font-medium text-blue-900">{selectedCategory.name}</span>
            {selectedCategory.description && (
              <span className="text-sm text-blue-700">- {selectedCategory.description}</span>
            )}
          </div>
        </div>
      )}

      {/* No Category Selected */}
      {!selectedCategory && categories.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            No category selected. Please select a category for this document.
          </p>
        </div>
      )}
    </div>
  );
} 