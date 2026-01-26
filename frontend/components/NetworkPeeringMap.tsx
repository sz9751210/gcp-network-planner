import React, { useMemo, useState, useRef, useEffect } from 'react';
import { GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
}

interface Node {
  id: string;
  vpcName: string;
  projectId: string;
  isHost: boolean;
  subnetCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  state: string;
}

interface Cluster {
  projectId: string;
  projectName: string; // Add friendly name
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NetworkPeeringMap: React.FC<Props> = ({ projects }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // --- Graph Layout Calculation ---
  const { nodes, edges, clusters } = useMemo(() => {
    const _nodes: Node[] = [];
    const _edges: Edge[] = [];
    const _clusters: Cluster[] = [];
    
    // Config
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 70;
    const PADDING_X = 40;
    const PADDING_Y = 60;
    const CLUSTER_PADDING = 30;
    const CLUSTER_GAP = 80;

    let currentX = 50;

    // 1. Layout Clusters (Projects) & Nodes (VPCs)
    // We lay out projects horizontally, and VPCs vertically within them
    projects.forEach(p => {
      if (p.vpcs.length === 0) return;

      const vpcCount = p.vpcs.length;
      const clusterWidth = NODE_WIDTH + (CLUSTER_PADDING * 2);
      const clusterHeight = (vpcCount * NODE_HEIGHT) + ((vpcCount - 1) * PADDING_Y) + (CLUSTER_PADDING * 2) + 20; // +20 for title

      const clusterY = 100; // Fixed top margin

      _clusters.push({
        projectId: p.projectId,
        projectName: p.name,
        x: currentX,
        y: clusterY,
        width: clusterWidth,
        height: clusterHeight
      });

      p.vpcs.forEach((v, index) => {
        // Mock ID construction needs to match how we define TargetNetwork in mockData
        // Ideally, backend provides consistent selfLinks.
        // MOCK DATA uses: `projects/${p.projectId}/global/networks/${v.name}`
        const nodeId = `projects/${p.projectId}/global/networks/${v.name}`;
        
        _nodes.push({
          id: nodeId,
          vpcName: v.name,
          projectId: p.projectId,
          isHost: v.isSharedVpcHost,
          subnetCount: v.subnets.length,
          x: currentX + CLUSTER_PADDING,
          y: clusterY + CLUSTER_PADDING + 30 + (index * (NODE_HEIGHT + PADDING_Y)),
          width: NODE_WIDTH,
          height: NODE_HEIGHT
        });
      });

      currentX += clusterWidth + CLUSTER_GAP;
    });

    // 2. Build Edges
    const nodeMap = new Map(_nodes.map(n => [n.id, n]));

    projects.forEach(p => {
      p.vpcs.forEach(v => {
        if (!v.peerings) return;
        
        const sourceId = `projects/${p.projectId}/global/networks/${v.name}`;
        
        v.peerings.forEach(peering => {
           // We need to resolve the target ID.
           // In a real app, strict parsing of `peering.targetNetwork` is needed.
           // Mock Data targetNetwork format: "projects/..." (matches our node ID format)
           const targetId = peering.targetNetwork;

           // Only draw if both nodes exist in our visible graph
           if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
             // Deduplicate edges: check if reverse edge exists
             const edgeId = [sourceId, targetId].sort().join('-');
             if (!_edges.find(e => e.id === edgeId)) {
                _edges.push({
                  id: edgeId,
                  sourceId,
                  targetId,
                  state: peering.state
                });
             }
           }
        });
      });
    });

    return { nodes: _nodes, edges: _edges, clusters: _clusters };
  }, [projects]);


  // --- Event Handlers for Pan/Zoom ---

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
       // Browser zoom usually takes precedence, but for map zoom:
       e.preventDefault();
    }
    const scaleFactor = 0.001;
    const newScale = Math.min(Math.max(0.2, transform.scale - e.deltaY * scaleFactor), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    setTransform(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Auto-center on load
  useEffect(() => {
     if (containerRef.current && clusters.length > 0) {
        const totalWidth = clusters[clusters.length-1].x + clusters[clusters.length-1].width;
        const containerW = containerRef.current.clientWidth;
        const scale = Math.min(1, (containerW - 100) / totalWidth);
        const startX = (containerW - (totalWidth * scale)) / 2;
        setTransform({ x: Math.max(0, startX), y: 50, scale });
     }
  }, [clusters]);


  // --- Helper to calculate path ---
  const getPath = (edge: Edge) => {
    const source = nodes.find(n => n.id === edge.sourceId);
    const target = nodes.find(n => n.id === edge.targetId);
    if (!source || !target) return '';

    // Logic to attach to Left or Right side depending on relative position
    const isSourceLeft = source.x < target.x;
    
    const startX = isSourceLeft ? source.x + source.width : source.x;
    const startY = source.y + (source.height / 2);
    
    const endX = isSourceLeft ? target.x : target.x + target.width;
    const endY = target.y + (target.height / 2);

    const dist = Math.abs(endX - startX);
    const controlOffset = Math.max(dist * 0.5, 50);

    // Cubic Bezier
    return `M ${startX} ${startY} C ${isSourceLeft ? startX + controlOffset : startX - controlOffset} ${startY}, ${isSourceLeft ? endX - controlOffset : endX + controlOffset} ${endY}, ${endX} ${endY}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative selection:bg-transparent">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-between items-start bg-gradient-to-b from-slate-950 to-transparent">
         <div>
            <h2 className="text-2xl font-bold text-white tracking-tight pointer-events-auto">VPC Peering Map</h2>
            <p className="text-slate-400 mt-1 pointer-events-auto text-sm">Interactive visualization of VPC Network Peering topology.</p>
         </div>
         <div className="flex flex-col gap-2 pointer-events-auto">
             <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs shadow-lg">
                <div className="font-semibold text-slate-300 mb-2 uppercase tracking-wider">Legend</div>
                <div className="space-y-2">
                   <div className="flex items-center"><div className="w-3 h-3 rounded-sm bg-purple-500/20 border border-purple-500 mr-2 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div> Shared VPC Host</div>
                   <div className="flex items-center"><div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500 mr-2"></div> Standard VPC</div>
                   <div className="flex items-center"><div className="w-6 h-0.5 bg-emerald-500 mr-2 relative"><div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full -translate-y-1/2 -translate-x-1/2"></div></div> Active Peering</div>
                </div>
             </div>
             <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-2 flex justify-center space-x-2 shadow-lg">
                <button 
                  onClick={() => setTransform(p => ({...p, scale: p.scale + 0.1}))}
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
                <button 
                  onClick={() => setTransform(p => ({...p, scale: Math.max(0.2, p.scale - 0.1)}))}
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <button 
                  onClick={() => setTransform({ x: 50, y: 50, scale: 0.8 })} // Quick Reset
                  className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  title="Reset View"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
             </div>
         </div>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef}
        className="flex-grow w-full h-full cursor-grab active:cursor-grabbing bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg className="w-full h-full pointer-events-none">
          {/* Background Grid Pattern */}
          <defs>
             <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
             </pattern>
             {/* Gradients */}
             <linearGradient id="hostGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(147, 51, 234, 0.1)" />
                <stop offset="100%" stopColor="rgba(147, 51, 234, 0.02)" />
             </linearGradient>
             <linearGradient id="vpcGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.1)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.02)" />
             </linearGradient>
             <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
               <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
               <feMerge>
                 <feMergeNode in="coloredBlur"/>
                 <feMergeNode in="SourceGraphic"/>
               </feMerge>
             </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
             
             {/* 1. Draw Clusters (Project Boxes) */}
             {clusters.map(cluster => (
               <g key={cluster.projectId} className="pointer-events-auto">
                  <rect 
                    x={cluster.x} 
                    y={cluster.y} 
                    width={cluster.width} 
                    height={cluster.height} 
                    rx="16"
                    fill="rgba(30, 41, 59, 0.4)"
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeDasharray="4 4"
                  />
                  {/* Project Label */}
                  <g transform={`translate(${cluster.x + 20}, ${cluster.y - 12})`}>
                     <rect x="-8" y="-14" width={cluster.projectId.length * 8 + 20} height="20" fill="#020617" rx="4" />
                     <text fill="#94a3b8" fontSize="12" fontWeight="bold" fontFamily="monospace">
                       {cluster.projectId}
                     </text>
                  </g>
               </g>
             ))}

             {/* 2. Draw Connections */}
             {edges.map(edge => {
               const isHovered = hoveredNodeId === edge.sourceId || hoveredNodeId === edge.targetId;
               const isDimmed = hoveredNodeId && !isHovered;
               
               return (
                 <g key={edge.id} className={`transition-opacity duration-300 ${isDimmed ? 'opacity-10' : 'opacity-100'}`}>
                    {/* Outer Glow Line */}
                    <path 
                      d={getPath(edge)}
                      fill="none"
                      stroke={edge.state === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}
                      strokeWidth="6"
                    />
                    {/* Inner Solid Line */}
                    <path 
                      d={getPath(edge)}
                      fill="none"
                      stroke={edge.state === 'ACTIVE' ? '#10b981' : '#f59e0b'}
                      strokeWidth="2"
                      strokeDasharray={edge.state === 'ACTIVE' ? '4 8' : '4 4'}
                      className={edge.state === 'ACTIVE' ? 'animate-[dash_1s_linear_infinite]' : ''}
                    />
                    {/* Moving Particle for Active Traffic */}
                    {edge.state === 'ACTIVE' && (
                        <circle r="3" fill="white">
                           <animateMotion dur="2s" repeatCount="indefinite" path={getPath(edge)} />
                        </circle>
                    )}
                 </g>
               );
             })}

             {/* 3. Draw Nodes (VPCs) */}
             {nodes.map(node => {
               const isDimmed = hoveredNodeId && hoveredNodeId !== node.id && !edges.some(e => 
                  (e.sourceId === node.id && e.targetId === hoveredNodeId) || 
                  (e.targetId === node.id && e.sourceId === hoveredNodeId)
               );
               const isSelected = hoveredNodeId === node.id;

               return (
                 <g 
                    key={node.id} 
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`transition-all duration-300 cursor-pointer pointer-events-auto ${isDimmed ? 'opacity-20' : 'opacity-100'} ${isSelected ? 'scale-105' : ''}`}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                 >
                    {/* Shadow */}
                    <rect 
                      x="0" y="4" width={node.width} height={node.height} rx="8"
                      fill="rgba(0,0,0,0.5)" filter="blur(4px)"
                    />
                    
                    {/* Main Card Body */}
                    <rect 
                       width={node.width} 
                       height={node.height} 
                       rx="8" 
                       fill={node.isHost ? "url(#hostGradient)" : "url(#vpcGradient)"}
                       stroke={node.isHost ? "#a855f7" : "#3b82f6"}
                       strokeWidth={isSelected ? 2 : 1}
                       className="backdrop-blur-md"
                    />

                    {/* Left Stripe Indicator */}
                    <rect width="4" height={node.height} rx="2" fill={node.isHost ? "#a855f7" : "#3b82f6"} />

                    {/* Content */}
                    <g transform="translate(16, 20)">
                       <text fill={node.isHost ? "#e9d5ff" : "#dbeafe"} fontSize="14" fontWeight="600">
                          {node.vpcName}
                       </text>
                       <text y="20" fill="#94a3b8" fontSize="10">
                          {node.subnetCount} Subnets configured
                       </text>
                       
                       {/* Host Badge */}
                       {node.isHost && (
                         <g transform="translate(140, -5)">
                           <rect width="50" height="18" rx="4" fill="rgba(168, 85, 247, 0.2)" stroke="rgba(168, 85, 247, 0.4)" />
                           <text x="25" y="12" textAnchor="middle" fill="#d8b4fe" fontSize="9" fontWeight="bold">SHARED</text>
                         </g>
                       )}
                    </g>
                 </g>
               );
             })}
          </g>
        </svg>

        {/* CSS Animation for dashed lines */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes dash {
            to {
              stroke-dashoffset: -24;
            }
          }
        `}} />
      </div>
    </div>
  );
};