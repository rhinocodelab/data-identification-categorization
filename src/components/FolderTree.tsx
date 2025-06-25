'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileImage, Clock } from 'lucide-react';

interface CategorizedFile {
  fileName: string;
  category: string;
  timestamp: Date;
  score?: number;
  destPath: string;
}

interface FolderTreeProps {
  files: CategorizedFile[];
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  file?: CategorizedFile;
  isOpen?: boolean;
}

export default function FolderTree({ files }: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['auto-categorized']));

  // Build tree structure from files
  const buildTree = (files: CategorizedFile[]): TreeNode[] => {
    const root: TreeNode = {
      name: 'auto-categorized',
      type: 'folder',
      children: [],
      isOpen: true
    };

    // Group files by category
    const categoryGroups = files.reduce((groups, file) => {
      const category = file.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(file);
      return groups;
    }, {} as Record<string, CategorizedFile[]>);

    // Create category folders
    Object.entries(categoryGroups).forEach(([category, categoryFiles]) => {
      const categoryNode: TreeNode = {
        name: category,
        type: 'folder',
        children: categoryFiles.map(file => ({
          name: file.fileName,
          type: 'file' as const,
          file
        }))
      };
      root.children!.push(categoryNode);
    });

    return [root];
  };

  const tree = buildTree(files);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderNode = (node: TreeNode, level: number = 0, path: string = ''): React.ReactElement => {
    const currentPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(currentPath);
    const indent = level * 16;

    if (node.type === 'folder') {
      return (
        <div key={currentPath}>
          <div
            className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer select-none"
            style={{ paddingLeft: `${indent + 8}px` }}
            onClick={() => toggleFolder(currentPath)}
          >
            <div className="w-4 h-4 mr-1 flex items-center justify-center">
              {node.children && node.children.length > 0 ? (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )
              ) : (
                <div className="w-3 h-3" />
              )}
            </div>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 mr-2 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 mr-2 text-blue-500" />
            )}
            <span className="text-sm font-medium text-gray-700">{node.name}</span>
            {node.children && (
              <span className="ml-2 text-xs text-gray-500">
                ({node.children.length})
              </span>
            )}
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, level + 1, currentPath))}
            </div>
          )}
        </div>
      );
    } else {
      // File node
      const file = node.file!;
      return (
        <div
          key={currentPath}
          className="flex items-center py-1 px-2 hover:bg-gray-50 rounded cursor-pointer select-none"
          style={{ paddingLeft: `${indent + 24}px` }}
        >
          <div className="w-4 h-4 mr-1" />
          <FileImage className="w-4 h-4 mr-2 text-gray-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-900 truncate">{node.name}</span>
              {file.score && (
                <span className="text-xs text-gray-500">
                  ({file.score.toFixed(2)})
                </span>
              )}
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              {file.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="font-mono text-sm">
      {tree.map(node => renderNode(node))}
    </div>
  );
} 