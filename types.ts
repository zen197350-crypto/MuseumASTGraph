export interface GraphError {
  message: string;
  line?: number;
}

export interface RenderResult {
  svg: string;
  error: GraphError | null;
}

export interface GraphNode {
  id: string; // The internal ID (e.g. node1)
  name: string; // The label or title (e.g. "Start")
  color?: string;
  fillcolor?: string;
  x?: number; // Center X coordinate from Graphviz layout
  y?: number; // Center Y coordinate from Graphviz layout
  
  // Shape data extracted from Graphviz
  shapeType?: 'ellipse' | 'polygon';
  shapeData?: {
    rx?: number;
    ry?: number;
    points?: string; // Relative points for polygons
    radius?: number; // Approximate radius for collision detection
  };
}

export interface GraphEdge {
  id: string;
  source: string; // Name of source node
  target: string; // Name of target node
  label?: string; // The relationship type
  displayColor?: string; // The generated color for this relationship type
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type CosmeticAction = 'circles' | 'compact' | 'thickEdges' | 'thinOutlines' | 'fixedSize';