import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'https://esm.sh/d3@7';
import { GraphData, GraphNode, GraphEdge } from '../types';

export interface GraphViewerRef {
  zoomIn: () => void;
  zoomOut: () => void;
  pan: (dx: number, dy: number) => void;
  resetZoom: () => void;
  exportAsPng: () => void;
}

interface GraphViewerProps {
  svgContent: string;
  isLoading: boolean;
  onGraphDataParsed: (data: GraphData) => void;
  selectedNodeId: string | null;
  onNodeClick: (nodeName: string | null) => void;
  isFancyMode: boolean;
  isFreeMove: boolean;
}

interface ParsedLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewBox: string;
  transform: string;
}

// Consistent palette for edge types
const TYPE_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#d946ef", // fuchsia-500
  "#f43f5e", // rose-500
  "#6366f1", // indigo-500
];

const getTypeColor = (type: string) => {
  if (!type) return "#94a3b8"; // slate-400 for untyped
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TYPE_COLORS.length;
  return TYPE_COLORS[index];
};

const GraphViewer = forwardRef<GraphViewerRef, GraphViewerProps>(({ 
  svgContent, 
  isLoading, 
  onGraphDataParsed,
  selectedNodeId,
  onNodeClick,
  isFancyMode,
  isFreeMove
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  
  // Ref to track selection inside D3 callbacks/filters
  const selectedNodeIdRef = useRef(selectedNodeId);
  const isFancyModeRef = useRef(isFancyMode);
  const isFreeMoveRef = useRef(isFreeMove);

  // Store layout data extracted from SVG
  const [layoutData, setLayoutData] = useState<ParsedLayout | null>(null);
  
  // Track zoom state to persist across mode switches
  const savedTransform = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    isFancyModeRef.current = isFancyMode;
  }, [isFancyMode]);

  useEffect(() => {
    isFreeMoveRef.current = isFreeMove;
  }, [isFreeMove]);

  // Parse SVG to extract Graph Data and Layout Coordinates
  useEffect(() => {
    if (!svgContent) {
      setLayoutData(null);
      return;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgEl = doc.querySelector('svg');
    const viewBox = svgEl?.getAttribute('viewBox') || '0 0 100 100';
    
    // Graphviz usually puts the main graph in a group with class "graph" and a transform
    const graphG = doc.querySelector('g.graph');
    const transform = graphG?.getAttribute('transform') || '';
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Extract Nodes
    doc.querySelectorAll('.node').forEach((el) => {
      const title = el.querySelector('title')?.textContent || '';
      
      const textEl = el.querySelector('text');
      const ellipseEl = el.querySelector('ellipse, circle');
      const polygonEl = el.querySelector('polygon');
      const pathEl = el.querySelector('path'); // fallback for complex shapes
      
      // 1. Determine Center (cx, cy)
      // Text usually marks the visual center in Graphviz output
      let x = 0;
      let y = 0;
      
      if (textEl) {
        x = parseFloat(textEl.getAttribute('x') || '0');
        y = parseFloat(textEl.getAttribute('y') || '0');
      } else if (ellipseEl) {
        x = parseFloat(ellipseEl.getAttribute('cx') || '0');
        y = parseFloat(ellipseEl.getAttribute('cy') || '0');
      }

      // 2. Extract Shape & Visuals
      let shapeType: 'ellipse' | 'polygon' = 'ellipse';
      let shapeData: any = { rx: 27, ry: 18, radius: 30 }; // Fallback defaults
      
      const mainShape = polygonEl || ellipseEl || pathEl;
      const fill = mainShape?.getAttribute('fill');
      const stroke = mainShape?.getAttribute('stroke');

      if (polygonEl) {
        shapeType = 'polygon';
        const rawPoints = polygonEl.getAttribute('points') || '';
        
        // Convert absolute points to relative (offset by center x,y)
        // Also calculate max radius for collision
        let maxDist = 0;
        const relativePoints = rawPoints.trim().split(' ').map(p => {
           const [px, py] = p.split(',').map(Number);
           const rx = px - x;
           const ry = py - y;
           const dist = Math.sqrt(rx*rx + ry*ry);
           if (dist > maxDist) maxDist = dist;
           return `${rx},${ry}`;
        }).join(' ');

        shapeData = {
          points: relativePoints,
          radius: maxDist
        };

      } else if (ellipseEl) {
        shapeType = 'ellipse';
        const rx = parseFloat(ellipseEl.getAttribute('rx') || '27');
        const ry = parseFloat(ellipseEl.getAttribute('ry') || '18');
        shapeData = {
          rx,
          ry,
          radius: Math.max(rx, ry)
        };
      }
      // If 'path', we fallback to ellipse for now as path parsing is complex without external libs,
      // but Graphviz mostly uses polygons for standard shapes (box, diamond, etc.)
      
      nodes.push({
        id: title,
        name: title,
        color: stroke || undefined,
        fillcolor: fill || undefined,
        x,
        y,
        shapeType,
        shapeData
      });
    });

    // Extract Edges
    doc.querySelectorAll('.edge').forEach((el) => {
      const title = el.querySelector('title')?.textContent || '';
      // Graphviz titles are "source->target" or "source--target"
      const parts = title.split(/-+>|--/); 
      
      // Extract Label (Edge Type)
      // Usually in a <text> element inside the group
      const textEl = el.querySelector('text');
      const label = textEl ? textEl.textContent?.trim() : undefined;
      const displayColor = getTypeColor(label || '');

      if (parts.length >= 2) {
        edges.push({
          id: title,
          source: parts[0],
          target: parts[1],
          label: label,
          displayColor: displayColor
        });
      }
    });

    const parsed = { nodes, edges, viewBox, transform };
    setLayoutData(parsed);
    onGraphDataParsed({ nodes, edges });
  }, [svgContent]);

  // Reusable Zoom Logic
  const performZoom = (direction: 'in' | 'out') => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    
    const svg = svgRef.current;
    const width = (svg.node() as SVGSVGElement).clientWidth;
    const height = (svg.node() as SVGSVGElement).clientHeight;
    
    let cx = width / 2;
    let cy = height / 2;

    if (selectedNodeId) {
      // Logic differs slightly between modes because DOM structure differs
      let nodeCx = 0, nodeCy = 0;
      let found = false;

      if (isFancyModeRef.current) {
        const nodeData = svg.selectAll('.fancy-node')
          .filter((d: any) => d.id === selectedNodeId)
          .datum() as any;
        if (nodeData) {
           // In fancy mode, d.x/d.y are current positions. 
           nodeCx = nodeData.x!;
           nodeCy = nodeData.y!;
           found = true;
        }
      } else {
        const nodeSelection = svg.selectAll('.node').filter(function() {
          return d3.select(this).select('title').text() === selectedNodeId;
        });
        const nodeEl = nodeSelection.node() as SVGGraphicsElement;
        if (nodeEl) {
           const bbox = nodeEl.getBBox();
           const matrix = nodeEl.getScreenCTM();
           if (matrix) {
             const localCx = bbox.x + bbox.width / 2;
             const localCy = bbox.y + bbox.height / 2;
             
             const screenX = matrix.a * localCx + matrix.c * localCy + matrix.e;
             const screenY = matrix.b * localCx + matrix.d * localCy + matrix.f;
             
             const svgRect = (svg.node() as Element).getBoundingClientRect();
             cx = screenX - svgRect.left;
             cy = screenY - svgRect.top;
             
             found = true;
           }
        }
      }

      if (found) {
          // Centered on node
      } else {
         cx = width / 2;
         cy = height / 2;
      }
    }

    const scaleFactor = direction === 'in' ? 1.3 : (1 / 1.3);

    svg.transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy, scaleFactor, [cx, cy]
    );
  };

  // Setup D3 Zoom on an SVG element
  const setupZoom = (svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>, gSelection: d3.Selection<SVGGElement, unknown, null, undefined>) => {
     const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.01, 200])
      .filter((event) => {
        if (event.type === 'wheel') {
          return !selectedNodeIdRef.current;
        }
        return !event.button;
      })
      .on('zoom', (event) => {
        gSelection.attr('transform', event.transform);
        savedTransform.current = event.transform;
      });

    svgSelection.call(zoom);
    // Restore saved transform
    svgSelection.call(zoom.transform, savedTransform.current);
    zoomBehaviorRef.current = zoom;
  };

  // Main Rendering Effect
  useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);

    // If no layout data (cleared or loading), clear container
    if (!layoutData) {
        container.selectAll("*").remove();
        if (simulationRef.current) {
            simulationRef.current.stop();
            simulationRef.current = null;
        }
        return;
    }
    
    // Cleanup previous simulation if exists
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Clear Container for re-render
    container.selectAll("*").remove();

    if (isFancyMode) {
      // --- FANCY MODE RENDER ---
      
      const svg = container.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', layoutData.viewBox)
        .classed('graph-svg fancy-mode', true);
      
      svgRef.current = svg;

      // Drop shadow definition
      const defs = svg.append("defs");
      const filter = defs.append("filter")
          .attr("id", "drop-shadow")
          .attr("height", "130%");
      filter.append("feGaussianBlur")
          .attr("in", "SourceAlpha")
          .attr("stdDeviation", 3)
          .attr("result", "blur");
      filter.append("feOffset")
          .attr("in", "blur")
          .attr("dx", 2)
          .attr("dy", 2)
          .attr("result", "offsetBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "offsetBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");
      
      // Marker definition for arrows
      const marker = defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 68) // Offset to sit outside circle radius (~60) - THIS MIGHT NEED TWEAKING FOR POLYGONS
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto");
      marker.append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

      // Main Group (receives zoom)
      const g = svg.append('g');
      // Apply the initial graph transform from Graphviz (scale/translate) inside the zoom group
      const contentG = g.append('g').attr('transform', layoutData.transform);
      
      gRef.current = g;
      setupZoom(svg, g);

      // --- CALCULATE CENTER AND SCALE FOR REDUCED EDGE LENGTH ---
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      layoutData.nodes.forEach(n => {
          const x = n.x || 0;
          const y = n.y || 0;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
      });
      
      // Geometric center of the layout
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      // Scaling factor to reduce edge lengths (compacting the graph)
      const FANCY_SCALE_FACTOR = 0.5;

      // Prepare Data for Simulation
      const simNodes = layoutData.nodes.map(n => {
        const originalX = n.x || 0;
        const originalY = n.y || 0;
        
        // Scale coordinates relative to the center
        const scaledX = centerX + (originalX - centerX) * FANCY_SCALE_FACTOR;
        const scaledY = centerY + (originalY - centerY) * FANCY_SCALE_FACTOR;

        return { 
          ...n, 
          x: scaledX, 
          y: scaledY,
          fx: scaledX,
          fy: scaledY,
          originX: scaledX,
          originY: scaledY
        };
      });
      
      const simLinks = layoutData.edges.map(e => ({ 
        ...e,
        source: e.source, 
        target: e.target 
      }));

      // Render Links with dynamic colors
      const link = contentG.append("g")
        .selectAll("line")
        .data(simLinks)
        .join("line")
        .attr("stroke", (d: any) => d.displayColor || "#999")
        .attr("stroke-opacity", 0.8)
        .attr("stroke-width", 2);

      // Render Nodes
      let isDragging = false; 
      let dragEnabled = false;
      let dragTimer: any = null;

      const node = contentG.append("g")
        .selectAll("g")
        .data(simNodes)
        .join("g")
        .attr("class", "fancy-node")
        .style("cursor", "grab")
        .call(d3.drag<SVGGElement, any>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );

      // Hover Effect: Scale 1.5x and Raise
      node.on("mouseenter", function() {
        if (isDragging) return;
        d3.select(this).raise(); // Bring node to front so it's not hidden by others when scaled
        d3.select(this).select(".node-content")
          .transition().duration(200)
          .attr("transform", "scale(1.5)");
      })
      .on("mouseleave", function() {
        d3.select(this).select(".node-content")
          .transition().duration(200)
          .attr("transform", "scale(1)");
      });

      // Add Tooltip (Title) to Node Group
      node.append("title").text((d: any) => d.name);

      // Create an inner group for content to separate scaling (visual) from translation (simulation)
      const nodeContent = node.append("g").attr("class", "node-content");

      // Append shapes based on shapeType to Inner Group
      nodeContent.each(function(d: any) {
        const g = d3.select(this);
        const fill = d.fillcolor && d.fillcolor !== 'none' ? d.fillcolor : "#fff";
        const stroke = d.color || "#666";

        if (d.shapeType === 'polygon' && d.shapeData?.points) {
          g.append("polygon")
           .attr("points", d.shapeData.points)
           .attr("fill", fill)
           .attr("stroke", stroke)
           .attr("stroke-width", 2)
           .style("filter", "url(#drop-shadow)");
        } else {
          // Default to ellipse
          g.append("ellipse")
           .attr("rx", d.shapeData?.rx || 30)
           .attr("ry", d.shapeData?.ry || 20)
           .attr("fill", fill)
           .attr("stroke", stroke)
           .attr("stroke-width", 2)
           .style("filter", "url(#drop-shadow)");
        }
      });

      // Append Text to Inner Group
      nodeContent.append("text")
        .text(d => d.name)
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .style("font-family", "Helvetica,Arial,sans-serif")
        .style("font-size", "75px") // Matching injected fontsize
        .style("font-weight", "semibold") 
        .style("pointer-events", "auto") // Allow hover events on text
        .style("user-select", "none");   // Prevent text selection cursor

      // Simulation
      const simulation = d3.forceSimulation(simNodes)
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).strength(0.8))
        .force("charge", d3.forceManyBody().strength(-1000))
        // Dynamic collision radius based on shape size + padding
        .force("collide", d3.forceCollide((d: any) => (d.shapeData?.radius || 40) + 15))
        .force("anchorX", d3.forceX((d: any) => d.originX).strength(1))
        .force("anchorY", d3.forceY((d: any) => d.originY).strength(1));

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        node
          .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      simulationRef.current = simulation;

      // --- Drag Function Helpers ---

      function getNeighbors(d: any) {
        const neighbors: any[] = [];
        simLinks.forEach((l: any) => {
          if (l.source.id === d.id) neighbors.push(l.target);
          else if (l.target.id === d.id) neighbors.push(l.source);
        });
        return neighbors;
      }

      function dragstarted(event: any, d: any) {
        isDragging = false; 
        dragEnabled = false;
        
        dragTimer = setTimeout(() => {
          dragEnabled = true;
          
          if (!event.active) simulation.alphaTarget(0.3).restart();
          
          d.fx = d.x;
          d.fy = d.y;
          
          d3.select(event.sourceEvent.target).style("cursor", "grabbing");
          d3.select(this as any).style("cursor", "grabbing");

          const neighbors = getNeighbors(d);
          const affected = [d, ...neighbors];
          const affectedIds = new Set(affected.map(n => n.id));

          svg.selectAll('.fancy-node')
             .filter((n: any) => affectedIds.has(n.id))
             .interrupt();

          neighbors.forEach(n => {
             n.fx = null;
             n.fy = null;
          });
        }, 300);
      }

      function dragged(event: any, d: any) {
        if (!dragEnabled) return;
        isDragging = true; 
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: any, d: any) {
        clearTimeout(dragTimer);

        if (!dragEnabled) {
          return;
        }

        if (!event.active) simulation.alphaTarget(0);
        d3.select(this).style("cursor", "grab");
        
        if (isFreeMoveRef.current) {
          d.fx = null;
          d.fy = null;
          return;
        }

        const neighbors = getNeighbors(d);
        const affected = [d, ...neighbors];
        const affectedIds = new Set(affected.map(n => n.id));

        svg.selectAll('.fancy-node')
            .filter((nodeData: any) => affectedIds.has(nodeData.id))
            .transition()
            .duration(500)
            .ease(d3.easeQuadOut)
            .tween("returnToOrigin", function(nodeData: any) {
              const iX = d3.interpolateNumber(nodeData.x, nodeData.originX);
              const iY = d3.interpolateNumber(nodeData.y, nodeData.originY);
              
              return function(t) {
                const cx = iX(t);
                const cy = iY(t);
                nodeData.fx = cx;
                nodeData.fy = cy;
                simulation.alpha(0.1).restart(); 
              };
            })
            .on("end", function(nodeData: any) {
                nodeData.fx = nodeData.originX;
                nodeData.fy = nodeData.originY;
                simulation.alpha(0.1).restart();
            });
      }

      node.on('click', function(event, d) {
        if (isDragging) {
            event.stopPropagation();
            return;
        }
        event.stopPropagation();
        onNodeClick(d.id);
      });
      
      svg.on('click', () => onNodeClick(null));

    } else {
      // --- BASIC MODE RENDER ---
      
      container.html(svgContent);
      const svgElement = container.select<SVGSVGElement>('svg');
      if (svgElement.empty()) return;

      svgElement
        .attr('width', '100%')
        .attr('height', '100%')
        .classed('graph-svg', true);

      svgRef.current = svgElement;

      // Color edges in Basic Mode based on extracted types
      // We iterate over the extracted edges and apply styles to matching DOM elements
      if (layoutData?.edges) {
        layoutData.edges.forEach(edge => {
          if (edge.displayColor) {
             // Find the edge group by title (graphviz standard)
             // We have to be careful about escaping
             svgElement.selectAll('.edge').filter(function() {
                const title = d3.select(this).select('title').text();
                return title === edge.id;
             }).each(function() {
                // Apply color to path and polygon
                const g = d3.select(this);
                g.select('path').attr('stroke', edge.displayColor!).attr('stroke-width', 2);
                g.select('polygon').attr('stroke', edge.displayColor!).attr('fill', edge.displayColor!);
                // Color the text label too if it exists
                g.select('text').attr('fill', edge.displayColor!);
             });
          }
        });
      }

      const originalG = svgElement.select<SVGGElement>('g');
      const zoomG = svgElement.append('g').attr('class', 'zoom-wrapper');
      
      if (!originalG.empty()) {
        zoomG.node()?.appendChild(originalG.node() as Node);
      }

      gRef.current = zoomG;

      setupZoom(svgElement, zoomG);

      svgElement.selectAll('.node')
        .on('click', function(event, d) {
          event.stopPropagation();
          const title = d3.select(this).select('title').text();
          onNodeClick(title);
        });

      svgElement.on('click', (event) => {
         onNodeClick(null);
      });
    }

  }, [layoutData, isFancyMode]); // Re-render when data or mode changes

  // Handle Free Move Toggle Effect
  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;

    if (isFreeMove) {
      // --- ENABLE FREE MOVE ---
      simulation.nodes().forEach((d: any) => {
        d.fx = null;
        d.fy = null;
      });

      simulation.force("anchorX", d3.forceX((d: any) => d.originX).strength(0.05));
      simulation.force("anchorY", d3.forceY((d: any) => d.originY).strength(0.05));
      simulation.force("collide", d3.forceCollide((d: any) => (d.shapeData?.radius || 40) + 100)); // Larger collision radius for free move

      const linkForce = simulation.force("link") as d3.ForceLink<any, any>;
      if (linkForce) {
        linkForce.strength(0.1);
        linkForce.distance(200); 
      }

      simulation.alpha(1).restart();

    } else {
      // --- DISABLE FREE MOVE ---
      if (svgRef.current) {
         svgRef.current.selectAll('.fancy-node')
            .transition()
            .duration(750)
            .ease(d3.easeQuadOut)
            .tween("returnToOriginGlobal", function(d: any) {
               const iX = d3.interpolateNumber(d.x, d.originX);
               const iY = d3.interpolateNumber(d.y, d.originY);
               return function(t) {
                 const cx = iX(t);
                 const cy = iY(t);
                 d.x = cx;
                 d.y = cy;
                 d.fx = cx; // Lock
                 d.fy = cy;
                 simulation.alpha(0.1).restart();
               };
            })
            .on("end", function(d: any) {
               d.fx = d.originX;
               d.fy = d.originY;
            });
      }

      simulation.force("anchorX", d3.forceX((d: any) => d.originX).strength(1));
      simulation.force("anchorY", d3.forceY((d: any) => d.originY).strength(1));
      simulation.force("collide", d3.forceCollide((d: any) => (d.shapeData?.radius || 40) + 15));

      const linkForce = simulation.force("link") as d3.ForceLink<any, any>;
      if (linkForce) {
        linkForce.strength(0.8);
        linkForce.distance(30);
      }
      
      simulation.alpha(0.3).restart();
    }
  }, [isFreeMove]);

  // Handle Selection Highlighting
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    
    // Basic Mode selectors
    const nodeSelector = isFancyMode ? '.fancy-node' : '.node';
    const edgeSelector = isFancyMode ? 'line' : '.edge';

    // Clear styles
    svg.classed('has-selection', !!selectedNodeId);
    svg.selectAll(nodeSelector).classed('selected', false).classed('connected', false).style('opacity', null);
    svg.selectAll(edgeSelector).classed('connected', false).style('opacity', null);

    if (selectedNodeId) {
      // Dim everything first
      svg.selectAll(nodeSelector).style('opacity', 0.1);
      svg.selectAll(edgeSelector).style('opacity', 0.1);

      // Highlight Selected Node
      const selected = svg.selectAll(nodeSelector).filter(function(d: any) {
        if (isFancyMode) return d.id === selectedNodeId;
        return d3.select(this).select('title').text() === selectedNodeId;
      });
      
      selected.classed('selected', true).style('opacity', 1);

      // Highlight Connected
      const edges = layoutData?.edges || [];
      const connectedNodes = new Set<string>();

      edges.forEach(e => {
        if (e.source === selectedNodeId) connectedNodes.add(e.target);
        if (e.target === selectedNodeId) connectedNodes.add(e.source);
      });

      // Highlight connected nodes
      svg.selectAll(nodeSelector).filter(function(d: any) {
         const id = isFancyMode ? d.id : d3.select(this).select('title').text();
         return connectedNodes.has(id);
      }).classed('connected', true).style('opacity', 1);

      // Highlight connected edges
      if (isFancyMode) {
         svg.selectAll('line').filter((d: any) => 
            d.source.id === selectedNodeId || d.target.id === selectedNodeId
         ).classed('connected', true).style('opacity', 1).attr('stroke-width', 3);
      } else {
         svg.selectAll('.edge').filter(function() {
            const title = d3.select(this).select('title').text();
            const parts = title.split(/-+>|--/);
            return parts.includes(selectedNodeId);
         }).classed('connected', true).style('opacity', 1);
      }
    } else {
        // Reset edge stroke width in fancy mode
        if (isFancyMode) {
            svg.selectAll('line').attr('stroke-width', 2);
        }
    }

  }, [selectedNodeId, isFancyMode, layoutData]);

  // Handle Wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (selectedNodeId) {
      if (e.deltaY < 0) performZoom('in');
      else performZoom('out');
    }
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => performZoom('in'),
    zoomOut: () => performZoom('out'),
    pan: (dx, dy) => {
       if (!svgRef.current || !zoomBehaviorRef.current) return;
       svgRef.current.transition().duration(200).call(
         zoomBehaviorRef.current.translateBy, dx, dy
       );
    },
    resetZoom: () => {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      svgRef.current.transition().duration(750).call(
        zoomBehaviorRef.current.transform, 
        d3.zoomIdentity
      );
      savedTransform.current = d3.zoomIdentity;
    },
    exportAsPng: () => {
      if (!svgRef.current) return;
      const svgNode = svgRef.current.node() as SVGSVGElement;
      
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgNode);

      // Add namespaces
      if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
          source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if(!source.match(/^<svg[^>]+xmlns:xlink/)){
          source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }

      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const rect = svgNode.getBoundingClientRect();
      const scale = 2; // Retina quality
      
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      
      const image = new Image();
      image.onload = () => {
        if (context) {
           // Fill white background
           context.fillStyle = '#ffffff';
           context.fillRect(0, 0, canvas.width, canvas.height);
           
           context.scale(scale, scale);
           context.drawImage(image, 0, 0);
           
           const pngUrl = canvas.toDataURL("image/png");
           const downloadLink = document.createElement("a");
           downloadLink.href = pngUrl;
           downloadLink.download = `graphviz-export-${Date.now()}.png`;
           document.body.appendChild(downloadLink);
           downloadLink.click();
           document.body.removeChild(downloadLink);
        }
      };
      image.src = url;
    }
  }), [selectedNodeId]);

  return (
    <div 
      className="relative w-full h-full bg-dot-pattern overflow-hidden"
      onWheel={handleWheel}
    >
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
            <span className="text-sm font-medium text-blue-800">Rendering...</span>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      
      {!svgContent && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <p>Graph Visualization Area</p>
        </div>
      )}
    </div>
  );
});

export default GraphViewer;