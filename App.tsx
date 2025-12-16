import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import GraphViewer, { GraphViewerRef } from './components/GraphViewer';
import Toolbar from './components/Toolbar';
import { layoutDot } from './services/graphvizService';
import { modifyDotCode } from './services/dotModifier';
import { INITIAL_DOT_CODE } from './constants';
import { GraphData, CosmeticAction } from './types';

function App() {
  const [code, setCode] = useState<string>(INITIAL_DOT_CODE);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  
  // Interactive State
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCosmetics, setActiveCosmetics] = useState<Set<CosmeticAction>>(new Set());
  const [isFancyMode, setIsFancyMode] = useState<boolean>(false);
  const [isFreeMove, setIsFreeMove] = useState<boolean>(false);

  const viewerRef = useRef<GraphViewerRef>(null);

  const handleUpdateGraph = useCallback(async (dotCode: string) => {
    // (a) completely delete existing visualization
    setSvgOutput('');
    setError(null);
    setGraphData({ nodes: [], edges: [] });
    // Reset selection safely
    setSelectedNodeId(null); 
    // Reset mode specific states that depend on graph data
    setIsFreeMove(false);

    if (!dotCode.trim()) {
      return;
    }

    setIsRendering(true);
    try {
      // (b) build new visualisation "from zero"
      const svg = await layoutDot(dotCode);
      setSvgOutput(svg);
    } catch (err: any) {
      console.error("Graphviz Error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsRendering(false);
    }
  }, []);

  // Initial render
  useEffect(() => {
    handleUpdateGraph(INITIAL_DOT_CODE);
  }, [handleUpdateGraph]);

  const handleCosmeticAction = (action: CosmeticAction) => {
    const isCurrentlyActive = activeCosmetics.has(action);
    const shouldEnable = !isCurrentlyActive;

    // Modify code (enable or disable)
    const newCode = modifyDotCode(code, action, shouldEnable);
    
    // Update State
    const newActiveSet = new Set(activeCosmetics);
    if (shouldEnable) {
      newActiveSet.add(action);
    } else {
      newActiveSet.delete(action);
    }
    setActiveCosmetics(newActiveSet);

    // Apply Changes
    setCode(newCode);
    handleUpdateGraph(newCode);
  };

  const handleNodeToggle = (nodeName: string | null) => {
    // If clicking the currently selected node, deselect it (toggle off)
    if (nodeName === selectedNodeId) {
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(nodeName);
    }
  };

  const handleResetZoom = () => {
    viewerRef.current?.resetZoom();
    setSelectedNodeId(null);
  };

  const toggleFancyMode = () => {
    const newMode = !isFancyMode;
    setIsFancyMode(newMode);
    if (!newMode) {
      setIsFreeMove(false);
    }
  };

  const handleExportPng = () => {
    viewerRef.current?.exportAsPng();
  };

  return (
    <div className="flex flex-col h-screen w-full relative">
      {/* Header - Minimalist */}
      <header className="flex-none px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between z-50 shadow-sm h-12">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">
            G
          </div>
          <h1 className="text-sm font-bold text-slate-800">GraphViz Live</h1>
        </div>
        <div className="text-xs text-slate-400">
           {graphData.nodes.length} Nodes • {graphData.edges.length} Edges
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex overflow-hidden relative">
        
        <Sidebar 
          code={code}
          onCodeChange={setCode}
          onUpdate={(newCode) => handleUpdateGraph(newCode ?? code)}
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleNodeToggle}
        />

        <div className="flex-grow h-full relative bg-slate-50">
          <GraphViewer 
            ref={viewerRef}
            svgContent={svgOutput} 
            isLoading={isRendering} 
            onGraphDataParsed={setGraphData}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeToggle}
            isFancyMode={isFancyMode}
            isFreeMove={isFreeMove}
          />

          <Toolbar 
            onZoomIn={() => viewerRef.current?.zoomIn()}
            onZoomOut={() => viewerRef.current?.zoomOut()}
            onPan={(dx, dy) => viewerRef.current?.pan(dx, dy)}
            onResetZoom={handleResetZoom}
            onCosmeticAction={handleCosmeticAction}
            activeCosmetics={activeCosmetics}
            onUpdate={() => handleUpdateGraph(code)}
            isFancyMode={isFancyMode}
            onToggleFancy={toggleFancyMode}
            isFreeMove={isFreeMove}
            onToggleFreeMove={() => setIsFreeMove(!isFreeMove)}
            onExportPng={handleExportPng}
          />
        </div>
      </main>
    </div>
  );
}

export default App;