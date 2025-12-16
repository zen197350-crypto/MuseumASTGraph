import React, { useState, useMemo, useEffect, useCallback } from 'react';
import CodeEditor from './CodeEditor';
import { GraphData, GraphNode, GraphEdge } from '../types';
import { EXAMPLE_GRAPHS } from '../constants';

interface SidebarProps {
  code: string;
  onCodeChange: (code: string) => void;
  onUpdate: (code?: string) => void;
  graphData: GraphData;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

interface ExampleGraph {
  id?: string;
  name: string;
  description: string;
  code: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  code, 
  onCodeChange, 
  onUpdate,
  graphData,
  selectedNodeId,
  onSelectNode
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'editor' | 'info'>('import');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isNodesExpanded, setIsNodesExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  // Dynamic examples state with LocalStorage persistence
  const [examples, setExamples] = useState<ExampleGraph[]>(() => {
    try {
      const saved = localStorage.getItem('graphviz-presets');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load presets", e);
    }
    return EXAMPLE_GRAPHS;
  });

  // Persist examples whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('graphviz-presets', JSON.stringify(examples));
    } catch (e) {
      console.error("Failed to save presets", e);
    }
  }, [examples]);

  // Sync with Backend Server
  useEffect(() => {
    const fetchFromBackend = async () => {
      try {
        // Use relative path for production deployment via Nginx
        const response = await fetch('/api/presets');
        if (response.ok) {
          const remotePresets: ExampleGraph[] = await response.json();
          setServerStatus('connected');
          
          setExamples(prev => {
            // Merge remote presets, avoiding duplicates by name
            const existingNames = new Set(prev.map(p => p.name));
            const newItems = remotePresets.filter(p => !existingNames.has(p.name));
            if (newItems.length > 0) {
              return [...prev, ...newItems];
            }
            return prev;
          });
        } else {
          setServerStatus('disconnected');
        }
      } catch (error) {
        setServerStatus('disconnected');
        // console.warn("Backend not available");
      }
    };

    fetchFromBackend();
  }, []); // Run once on mount

  // Auto-switch to Inspector tab when a node is selected
  useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('info');
      if (!isOpen) setIsOpen(true);
    }
  }, [selectedNodeId, isOpen]);

  // Search Logic
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return graphData.nodes;
    return graphData.nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [graphData.nodes, searchQuery]);

  const filteredEdges = useMemo(() => {
    if (!searchQuery) return graphData.edges;
    return graphData.edges.filter(e => 
      e.source.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.target.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [graphData.edges, searchQuery]);

  // Statistics for Dashboard (Nodes by Degree, Edges by Type)
  const stats = useMemo(() => {
    const nodeDegrees = new Map<string, number>();
    const edgeTypes = new Map<string, { count: number, color: string }>();

    // Initialize degrees
    graphData.nodes.forEach(n => nodeDegrees.set(n.id, 0));

    // Count degrees and classify edges
    graphData.edges.forEach(e => {
       nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1);
       nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1);

       const label = e.label || '(Unlabeled)';
       const current = edgeTypes.get(label) || { count: 0, color: e.displayColor || '#94a3b8' };
       edgeTypes.set(label, { count: current.count + 1, color: current.color });
    });

    const sortedNodes = [...graphData.nodes]
      .map(n => ({ ...n, degree: nodeDegrees.get(n.id) || 0 }))
      .sort((a, b) => b.degree - a.degree);

    const sortedEdges = Array.from(edgeTypes.entries())
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.count - a.count);

    return { nodes: sortedNodes, edges: sortedEdges };
  }, [graphData]);

  // Node Inspection Data
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = graphData.nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;

    const incoming = graphData.edges
      .filter(e => e.target === selectedNodeId)
      .map(e => ({ ...e, other: e.source, type: 'incoming' }));
    
    const outgoing = graphData.edges
      .filter(e => e.source === selectedNodeId)
      .map(e => ({ ...e, other: e.target, type: 'outgoing' }));

    return {
      node,
      incoming,
      outgoing
    };
  }, [selectedNodeId, graphData]);

  // Legend Data (Unique Colors)
  const legendColors = useMemo(() => {
    const colors = new Set<string>();
    const map = new Map<string, number>();
    graphData.nodes.forEach(n => {
      const c = n.fillcolor || n.color;
      if (c && c !== 'none' && c !== 'black') {
        colors.add(c);
        map.set(c, (map.get(c) || 0) + 1);
      }
    });
    return Array.from(colors).map(c => ({ color: c, count: map.get(c) }));
  }, [graphData.nodes]);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        onCodeChange(content);
        onUpdate(content);
        
        // Add uploaded file to examples list
        const newPreset = {
          name: file.name,
          description: 'Imported File',
          code: content
        };
        
        setExamples(prev => [...prev, newPreset]);
        setActiveTab('info');
        setSearchQuery(''); // Reset search to ensure new data is visible
      }
    };
    reader.readAsText(file);
  }, [onCodeChange, onUpdate]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
      event.target.value = ''; // Reset input
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const loadExample = (exampleCode: string) => {
    onCodeChange(exampleCode);
    onUpdate(exampleCode);
    setActiveTab('info');
    setSearchQuery(''); // Reset search to ensure new data is visible
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      alert("Please enter a name for the preset.");
      return;
    }

    const newPreset = {
      name: presetName,
      description: `Saved at ${new Date().toLocaleTimeString()}`,
      code: code
    };
    
    // Save Locally
    setExamples(prev => [...prev, newPreset]);
    setPresetName(''); // Clear input
    
    // Attempt to Save to Backend
    if (serverStatus === 'connected') {
      try {
        await fetch('/api/presets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newPreset),
        });
        // Success silently handled
      } catch (e) {
        console.error("Failed to save to backend", e);
      }
    }

    alert(`Preset "${presetName}" saved!`);
  };
  
  const handleDeletePreset = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this preset?")) {
      setExamples(prev => prev.filter((_, i) => i !== index));
    }
  };

  const renderRelationshipList = (edges: any[], title: string, icon: React.ReactNode) => {
    if (edges.length === 0) return null;
    return (
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {icon}
          {title} ({edges.length})
        </h4>
        <ul className="space-y-2">
          {edges.map((e, idx) => (
            <li 
              key={idx} 
              className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-md hover:border-blue-300 transition-colors group cursor-pointer shadow-sm"
              onClick={() => onSelectNode(e.other)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500"></div>
                <span className="text-sm font-medium text-slate-700 truncate">{e.other}</span>
              </div>
              
              {/* Type Badge */}
              <div className="flex-shrink-0 flex items-center gap-1.5">
                <span 
                  className="px-2 py-0.5 text-[10px] uppercase font-bold text-white rounded-full shadow-sm"
                  style={{ backgroundColor: e.displayColor || '#94a3b8' }}
                >
                  {e.label || 'Direct'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <div className="absolute left-0 top-20 z-40">
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-white border border-l-0 border-slate-300 rounded-r-md px-2 py-3 shadow-md hover:bg-slate-50 text-slate-500"
          title="Open Panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Legend Modal */}
      {showLegend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowLegend(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                 </svg>
                 Color Legend
              </h3>
              <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
               {legendColors.length > 0 ? (
                 <div className="grid grid-cols-1 gap-2">
                   {legendColors.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded shadow-sm">
                        <div className="w-6 h-6 rounded border border-slate-200 shadow-sm flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 capitalize truncate">{item.color}</p>
                          <p className="text-xs text-slate-400">{item.count} nodes</p>
                        </div>
                      </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-6">
                    <p className="text-slate-500 text-sm">No colored nodes found in the graph.</p>
                    <p className="text-slate-400 text-xs mt-1">Add <code className="bg-slate-100 px-1 rounded">color="red"</code> to your nodes.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col w-full md:w-96 h-1/2 md:h-full bg-white border-r border-slate-200 shadow-xl flex-none z-40 transition-all duration-300">
        {/* Header Tabs */}
        <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-2">
          <div className="flex overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'import' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Import
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'editor' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-3 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'info' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Inspector
            </button>
          </div>
          
          <div className="flex items-center gap-1 pl-2">
            {/* Legend Toggle Button (Only in Info Tab) */}
            {activeTab === 'info' && (
              <button 
                onClick={() => setShowLegend(true)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors"
                title="Open Color Legend Window"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
            )}

            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded"
              title="Close Panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-hidden relative bg-slate-50">
          
          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="h-full overflow-y-auto custom-scrollbar p-6">
              
              {/* Drag & Drop Area */}
              <div 
                className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all bg-white mb-8 ${isDragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-slate-300 hover:border-blue-400'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-slate-700 font-semibold mb-1">Upload DOT File</h3>
                <p className="text-slate-500 text-sm mb-4">Drag and drop your .gv or .dot file here</p>
                
                <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm text-sm font-medium text-white cursor-pointer transition-colors">
                  Browse Files
                  <input 
                    type="file" 
                    accept=".gv,.dot,.txt" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </label>
              </div>

              <div className="flex items-center gap-3 mb-6">
                 <div className="h-px bg-slate-200 flex-grow"></div>
                 <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Presets & History</span>
                 <div className="h-px bg-slate-200 flex-grow"></div>
              </div>
              
              {/* Server Status Indicator */}
              {serverStatus === 'connected' && (
                  <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-xs text-green-700">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Connected to Local Flask Backend
                  </div>
              )}

              {/* Example Graphs List */}
              <div className="space-y-3">
                 {examples.map((example, idx) => (
                    <div 
                      key={idx}
                      onClick={() => loadExample(example.code)}
                      className="group p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md cursor-pointer transition-all relative"
                    >
                       <div className="flex items-start justify-between">
                         <div>
                           <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{example.name}</h4>
                           <p className="text-xs text-slate-500 mt-1">{example.description}</p>
                         </div>
                         <div className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                         </div>
                       </div>
                       
                       {/* Delete button (don't show for the default Simple Process if desired, but here we allow deletion of anything except maybe index 0 if strict, but simpler to allow all or keep logic simple) */}
                       {idx > 0 && (
                          <button 
                            onClick={(e) => handleDeletePreset(e, idx)}
                            className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Preset"
                          >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                             </svg>
                          </button>
                       )}
                    </div>
                 ))}
              </div>

              <div className="mt-8 text-center">
                <p className="text-xs text-slate-400">
                  Uploaded files and saved presets are stored locally.
                  {serverStatus === 'connected' && " Synced with Flask backend."}
                </p>
              </div>

            </div>
          )}

          {/* EDITOR TAB */}
          {activeTab === 'editor' && (
            <div className="flex flex-col h-full">
              {/* Editor Header / Toolbar */}
              <div className="flex-none px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex-grow">
                   <input
                     type="text"
                     value={presetName}
                     onChange={(e) => setPresetName(e.target.value)}
                     placeholder="Preset name..."
                     className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                   />
                </div>
                <button 
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                     presetName.trim() 
                     ? 'text-blue-700 bg-blue-100 hover:bg-blue-200' 
                     : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                  }`}
                  title="Save current code as a new preset in the Import list"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </button>
              </div>
              
              <div className="flex-grow overflow-hidden relative">
                <CodeEditor 
                  code={code} 
                  onChange={onCodeChange}
                  onUpdate={() => onUpdate()}
                  error={null} 
                />
              </div>
            </div>
          )}

          {/* INSPECTOR TAB */}
          {activeTab === 'info' && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar space-y-6">
              
              {/* Search */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search nodes or edges..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {searchQuery && (
                  <div className="mt-2 text-sm">
                     <p className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-1">Results</p>
                     {filteredNodes.length === 0 && filteredEdges.length === 0 && <p className="text-slate-500 italic">No matches found.</p>}
                     <ul className="space-y-1">
                       {filteredNodes.map(node => (
                         <li 
                          key={node.id} 
                          onClick={() => onSelectNode(node.id)}
                          className={`cursor-pointer px-2 py-1 rounded flex items-center gap-2 ${selectedNodeId === node.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'}`}
                         >
                           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                           {node.name}
                         </li>
                       ))}
                       {filteredEdges.map((edge, i) => (
                         <li key={i} className="px-2 py-1 text-slate-500 text-xs truncate">
                           {edge.source} {edge.label ? `-[${edge.label}]->` : '->'} {edge.target}
                         </li>
                       ))}
                     </ul>
                  </div>
                )}
              </div>

              {/* Node Inspector */}
              {selectedNodeData ? (
                <div className="bg-slate-50 border border-slate-200 rounded p-4 shadow-sm animate-in slide-in-from-right-4 duration-200">
                  <button 
                    onClick={() => onSelectNode(null)}
                    className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-lg">{selectedNodeData.node.name}</h3>
                    {selectedNodeData.node.fillcolor && (
                      <div 
                        className="w-5 h-5 rounded border border-slate-300 shadow-sm"
                        style={{ backgroundColor: selectedNodeData.node.fillcolor }}
                        title={`Color: ${selectedNodeData.node.fillcolor}`}
                      ></div>
                    )}
                  </div>
                  
                  <div className="space-y-6">
                    {/* Incoming Connections */}
                    {renderRelationshipList(
                      selectedNodeData.incoming, 
                      "Incoming Connections",
                      <svg className="w-4 h-4 text-slate-400 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    )}

                    {/* Outgoing Connections */}
                    {renderRelationshipList(
                      selectedNodeData.outgoing, 
                      "Outgoing Connections",
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    )}

                    {selectedNodeData.incoming.length === 0 && selectedNodeData.outgoing.length === 0 && (
                      <p className="text-sm text-slate-400 italic text-center py-2">No connections found.</p>
                    )}
                  </div>
                </div>
              ) : (
                !searchQuery && (
                  <div className="space-y-6">
                    {/* Dashboard: Nodes by Frequency */}
                    <div>
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Nodes by Connections
                      </h3>
                      {stats.nodes.length > 0 ? (
                        <div className="space-y-1">
                          {(isNodesExpanded ? stats.nodes : stats.nodes.slice(0, 10)).map(node => (
                            <div 
                              key={node.id}
                              onClick={() => onSelectNode(node.id)}
                              className="flex items-center justify-between group cursor-pointer p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: node.fillcolor || node.color || '#cbd5e1' }}
                                ></div>
                                <span className="text-sm text-slate-700 truncate font-medium group-hover:text-blue-600">{node.name}</span>
                              </div>
                              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-700">
                                {node.degree}
                              </span>
                            </div>
                          ))}
                          {stats.nodes.length > 10 && (
                            <button
                                onClick={() => setIsNodesExpanded(!isNodesExpanded)}
                                className="w-full text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-100 py-2 rounded mt-1 font-medium transition-colors border border-transparent hover:border-slate-200"
                            >
                                {isNodesExpanded ? "Show Less" : `Show ${stats.nodes.length - 10} More`}
                            </button>
                          )}
                        </div>
                      ) : (
                         <div className="p-4 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                            <span className="text-xs text-slate-400">No nodes found.</span>
                         </div>
                      )}
                    </div>

                    {/* Dashboard: Edge Types by Frequency */}
                    <div>
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Relationship Types
                      </h3>
                      {stats.edges.length > 0 ? (
                        <div className="space-y-1">
                          {stats.edges.map((edge, idx) => (
                             <div 
                               key={idx}
                               className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                             >
                               <div className="flex items-center gap-2">
                                 <span 
                                   className="px-2 py-0.5 text-[10px] uppercase font-bold text-white rounded-full shadow-sm"
                                   style={{ backgroundColor: edge.color }}
                                 >
                                   {edge.label}
                                 </span>
                               </div>
                               <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                 {edge.count}
                               </span>
                             </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                           <span className="text-xs text-slate-400">No relationships found.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;