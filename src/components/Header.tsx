'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart2, Wand2 } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backUrl?: string;
  children?: React.ReactNode;
}

export default function Header({ 
  title = "Data Annotation, Identification & Categorization Tool", 
  subtitle = "Upload data files and manage your annotation projects",
  showBackButton = false,
  backUrl = "/",
  children 
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <header className="bg-blue-900 shadow-sm border-b border-blue-900">
      <div className="w-full py-2 pl-2 pr-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="px-2 py-1 text-xs rounded bg-blue-800 text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Back</span>
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white leading-tight">{title}</h1>
              <p className="text-gray-200 mt-1 text-xs leading-tight">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 pr-2">
            <button
              className="flex items-center px-2 py-1 text-xs rounded bg-blue-700 text-white hover:bg-blue-800 transition-colors font-semibold"
              onClick={() => router.push('/analytics')}
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              View Analytics
            </button>
            <button
              className="flex items-center px-2 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-800 transition-colors font-semibold"
              onClick={() => router.push('/auto-categorize')}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Auto Categorize
            </button>
            {children}
          </div>
        </div>
      </div>
    </header>
  );
} 