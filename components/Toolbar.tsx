import React from 'react';
import { CosmeticAction } from '../types';

interface ToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPan: (dx: number, dy: number) => void;
  onResetZoom: () => void;
  onCosmeticAction: (action: CosmeticAction) => void;
  activeCosmetics: Set<CosmeticAction>;
  onUpdate: () => void;
  isFancyMode: boolean;
  onToggleFancy: () => void;
  isFreeMove: boolean;
  onToggleFreeMove: () => void;
  onExportPng: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onZoomIn, 
  onZoomOut, 
  onPan,
  onResetZoom,
  onCosmeticAction,
  activeCosmetics,
  onUpdate,
  isFancyMode,
  onToggleFancy,
  isFreeMove,
  onToggleFreeMove,
  onExportPng
}) => {
  const getButtonClass = (action: CosmeticAction) => {
    const isActive = activeCosmetics.has(action);
    const base = "p-2 rounded-lg transition-colors border";
    if (isActive) {
      return `${base} bg-blue-100 text-blue-700 border-blue-200 shadow-inner`;
    }
    return `${base} text-slate-600 hover:bg-blue-50 hover:text-blue-600 border-transparent`;
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-3 items-center w-max max-w-full px-4">
      
      {/* Update & Appearance Panel */}
      <div className="flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-xl overflow-x-auto custom-scrollbar">
         <button
          onClick={onUpdate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 active:scale-95 transition-all text-sm font-semibold whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Update Graph
        </button>

        <button 
          onClick={onExportPng}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
          title="Export as PNG"
        >
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
           </svg>
           <span className="hidden sm:inline text-sm font-medium">Export</span>
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Fancy Mode Toggle */}
        <button
          onClick={onToggleFancy}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium border ${
            isFancyMode 
              ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-inner' 
              : 'text-slate-600 hover:bg-purple-50 hover:text-purple-600 border-transparent'
          }`}
          title="Toggle Fancy Mode"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Fancy
        </button>

        {isFancyMode && (
          <button
            onClick={onToggleFreeMove}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium border ${
              isFreeMove 
                ? 'bg-green-100 text-green-700 border-green-300 shadow-inner' 
                : 'text-slate-600 hover:bg-green-50 hover:text-green-600 border-transparent'
            }`}
            title="Toggle Free Move"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Free Move
          </button>
        )}

        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Cosmetic Buttons */}
        <div className="flex gap-1">
          <button 
            onClick={() => onCosmeticAction('circles')}
            className={getButtonClass('circles')}
            title="Toggle Nodes Circles"
          >
            <div className="w-5 h-5 border-2 border-current rounded-full"></div>
          </button>
          
          <button 
            onClick={() => onCosmeticAction('fixedSize')}
            className={getButtonClass('fixedSize')}
            title="Toggle Fixed Size Nodes"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          <button 
            onClick={() => onCosmeticAction('compact')}
            className={getButtonClass('compact')}
            title="Toggle Compact Layout"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button 
            onClick={() => onCosmeticAction('thickEdges')}
            className={getButtonClass('thickEdges')}
            title="Toggle Thick Edges"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <button 
            onClick={() => onCosmeticAction('thinOutlines')}
            className={getButtonClass('thinOutlines')}
            title="Toggle Thin Outlines"
          >
            <div className="w-5 h-5 border border-current rounded-full relative">
               <div className="absolute inset-0.5 border border-current rounded-full opacity-30"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Panel */}
      <div className="flex items-center gap-1 p-1 bg-slate-800/90 backdrop-blur shadow-lg border border-slate-700 rounded-full text-slate-200">
        
        {/* Zoom Controls */}
        <button onClick={onZoomOut} className="p-2 hover:text-white hover:bg-slate-700 rounded-full">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button onClick={onResetZoom} className="px-2 text-xs font-mono opacity-80 hover:opacity-100">
          RESET
        </button>
        <button onClick={onZoomIn} className="p-2 hover:text-white hover:bg-slate-700 rounded-full">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        <div className="w-px h-4 bg-slate-600 mx-1"></div>

        {/* Pan Controls */}
        <div className="flex gap-1">
          <button onClick={() => onPan(50, 0)} className="p-2 hover:text-white hover:bg-slate-700 rounded-full" title="Pan Left">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
           <div className="flex flex-col gap-1">
             <button onClick={() => onPan(0, 50)} className="p-0.5 hover:text-white hover:bg-slate-700 rounded" title="Pan Up">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
             </button>
             <button onClick={() => onPan(0, -50)} className="p-0.5 hover:text-white hover:bg-slate-700 rounded" title="Pan Down">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
             </button>
           </div>
          <button onClick={() => onPan(-50, 0)} className="p-2 hover:text-white hover:bg-slate-700 rounded-full" title="Pan Right">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Toolbar;