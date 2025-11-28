import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  MarkerType,
  useReactFlow,
  useOnSelectionChange,
} from '@xyflow/react';
import dagre from 'dagre';
import { 
  Save, Upload, Play, Plus, Trash2, 
  ChevronRight, ArrowLeft, Check, Circle, CheckSquare, 
  FileText, Flag, Settings, RotateCcw, Layout,
  Link as LinkIcon, X, Book, Folder, FileJson, Loader2
} from 'lucide-react';

// --- CATALOG CONFIGURATION ---
// Define your GitHub folders here.
// The app will fetch: https://api.github.com/repos/{owner}/{repo}/contents/{path}
interface CatalogFolderConfig {
  id: string;
  name: string;
  owner: string;
  repo: string;
  path: string;
}

const CATALOG_FOLDERS: CatalogFolderConfig[] = [
  {
    id: 'demo-1',
    name: 'Example Flowcharts',
    owner: 'langchain-ai', // Example: public repo
    repo: 'langgraph-example', // Example: public repo
    path: 'examples' // Example folder
  },
  {
    id: 'my-flows',
    name: 'My Saved Flows',
    owner: 'your-username',
    repo: 'your-repo',
    path: 'flowcharts'
  }
];

// --- Error Suppression ---
// ResizeObserver loop errors are benign layout thrashing warnings common in complex flex/grid + canvas apps.
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications';
const resizeObserverLoopLimitErr = 'ResizeObserver loop limit exceeded';

window.addEventListener('error', (e) => {
  if (
    e.message.includes(resizeObserverLoopErr) ||
    e.message.includes(resizeObserverLoopLimitErr)
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Patch console.error to catch frameworks/overlays that might intercept this
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' && 
    (args[0].includes(resizeObserverLoopErr) || args[0].includes(resizeObserverLoopLimitErr))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// --- Types ---

type FlowMode = 'editor' | 'viewer';

type NodeType = 'radio' | 'checkbox' | 'static' | 'end';

interface Option {
  id: string;
  label: string;
}

interface LogicPath {
  id: string; // Creates a Handle ID
  label: string;
  requiredOptionIds: string[]; // Logic: AND condition for these options
}

interface NodeData {
  label: string; // Internal name
  content: string; // Display text/question
  type: NodeType;
  options?: Option[]; // For radio/checkbox
  paths?: LogicPath[]; // For checkbox logic specifically
  canRestart?: boolean; // For end node
  [key: string]: unknown; // Fix: Index signature for Record<string, unknown> compatibility
}

type AppNode = Node<NodeData>;

// --- Constants ---

const INITIAL_NODES: AppNode[] = [
  {
    id: 'start',
    type: 'static',
    position: { x: 0, y: 150 },
    data: { label: 'Start', content: 'Welcome! Let us begin the process.', type: 'static' },
  },
];

const NODE_TYPES_CONFIG = {
  static: { 
    label: 'Info Card', 
    icon: FileText, 
    color: 'bg-gray-50 border-gray-200',
    description: 'Display text or information. No choices.'
  },
  radio: { 
    label: 'Single Choice', 
    icon: Circle, 
    color: 'bg-blue-50 border-blue-200',
    description: 'User must pick exactly one option.'
  },
  checkbox: { 
    label: 'Multiple Choice', 
    icon: CheckSquare, 
    color: 'bg-purple-50 border-purple-200',
    description: 'User can pick multiple options. Complex logic support.'
  },
  end: { 
    label: 'End Point', 
    icon: Flag, 
    color: 'bg-red-50 border-red-200',
    description: 'Finishes the flow. Optional restart.'
  },
};

// --- Utils ---

const getLayoutedElements = (nodes: AppNode[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = true;
  dagreGraph.setGraph({ rankdir: isHorizontal ? 'LR' : 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 150 }); // Estimate size
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- Custom Node Components (Editor) ---

const NodeHeader = ({ type, label }: { type: NodeType; label: string }) => {
  const Icon = NODE_TYPES_CONFIG[type].icon;
  return (
    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/50">
      <Icon size={14} className="text-gray-600" />
      <span className="text-xs font-bold uppercase text-gray-700 tracking-wider">{label}</span>
    </div>
  );
};

const StaticNodeComponent = ({ data, id }: { data: NodeData; id: string }) => (
  <div className="p-4 rounded-lg w-[280px] text-sm h-full">
    {id !== 'start' && <Handle type="target" position={Position.Left} className="!bg-gray-400" />}
    <NodeHeader type="static" label={data.label} />
    <p className="text-gray-800 line-clamp-3">{data.content}</p>
    <Handle type="source" position={Position.Right} className="!bg-blue-500" />
  </div>
);

const EndNodeComponent = ({ data }: { data: NodeData }) => (
  <div className="p-4 rounded-lg w-[280px] text-sm h-full bg-red-50/50">
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="end" label={data.label} />
    <p className="text-gray-800 mb-2">{data.content}</p>
    {data.canRestart && <div className="text-xs text-blue-700 font-medium">↺ Can Restart</div>}
  </div>
);

const RadioNodeComponent = ({ data }: { data: NodeData }) => (
  <div className="p-4 rounded-lg w-[300px] text-sm relative h-full bg-blue-50/50">
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="radio" label={data.label} />
    <p className="text-gray-800 mb-3 italic">{data.content}</p>
    <div className="space-y-2">
      {data.options?.map((opt, idx) => (
        <div key={opt.id} className="relative flex items-center justify-between bg-white p-2 rounded border border-blue-100 text-gray-800">
          <span>{opt.label}</span>
          <Handle
            type="source"
            position={Position.Right}
            id={opt.id}
            style={{ top: '50%', right: '-24px' }}
            className="!bg-blue-500"
          />
        </div>
      ))}
      {(!data.options || data.options.length === 0) && <div className="text-red-600 text-xs font-medium">No options defined</div>}
    </div>
  </div>
);

const CheckboxNodeComponent = ({ data }: { data: NodeData }) => (
  <div className="p-4 rounded-lg w-[320px] text-sm h-full bg-purple-50/50">
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="checkbox" label={data.label} />
    <p className="text-gray-800 mb-3 italic">{data.content}</p>
    
    <div className="mb-2 text-xs font-bold text-purple-900">Available Options:</div>
    <div className="flex flex-wrap gap-1 mb-4">
      {data.options?.map(opt => (
        <span key={opt.id} className="bg-white px-2 py-1 rounded border border-purple-100 text-xs text-gray-800">{opt.label}</span>
      ))}
    </div>

    <div className="mb-2 text-xs font-bold text-purple-900">Logic Paths (Outputs):</div>
    <div className="space-y-2">
      {data.paths?.map((path) => (
        <div key={path.id} className="relative flex items-center justify-between bg-white p-2 rounded border border-purple-100 text-gray-800">
          <div className="flex flex-col">
             <span className="font-medium">{path.label}</span>
             <span className="text-xs text-gray-600 mt-0.5">
               Requires: {path.requiredOptionIds.length > 0 
                  ? path.requiredOptionIds.map(id => data.options?.find(o => o.id === id)?.label || '???').join(' + ') 
                  : '(Any/Else)'}
             </span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id={path.id}
            style={{ top: '50%', right: '-24px' }}
            className="!bg-purple-500"
          />
        </div>
      ))}
    </div>
  </div>
);

const nodeTypes = {
  radio: RadioNodeComponent,
  checkbox: CheckboxNodeComponent,
  static: StaticNodeComponent,
  end: EndNodeComponent,
};

// --- Property Panel (Editor) ---

const PropertiesPanel = ({ selectedNode, updateNode }: { selectedNode: AppNode | null, updateNode: (id: string, data: Partial<NodeData>) => void }) => {
  if (!selectedNode) return (
    <div className="w-80 border-l border-gray-200 bg-gray-100 p-4 text-gray-500 flex flex-col items-center justify-center text-center">
      <Settings size={48} className="mb-4 opacity-30" />
      <p>Select a node to edit properties</p>
    </div>
  );

  const { data, id } = selectedNode;

  const addOption = () => {
    const newOpt = { id: `opt-${Date.now()}`, label: 'New Option' };
    const currentOpts = data.options || [];
    updateNode(id, { options: [...currentOpts, newOpt] });
  };

  const updateOption = (optId: string, label: string) => {
    const currentOpts = data.options || [];
    updateNode(id, { options: currentOpts.map(o => o.id === optId ? { ...o, label } : o) });
  };

  const removeOption = (optId: string) => {
    const currentOpts = data.options || [];
    updateNode(id, { options: currentOpts.filter(o => o.id !== optId) });
  };

  const addPath = () => {
    const newPath: LogicPath = { id: `path-${Date.now()}`, label: 'New Path', requiredOptionIds: [] };
    const currentPaths = data.paths || [];
    updateNode(id, { paths: [...currentPaths, newPath] });
  };

  const updatePath = (pathId: string, updates: Partial<LogicPath>) => {
    const currentPaths = data.paths || [];
    updateNode(id, { paths: currentPaths.map(p => p.id === pathId ? { ...p, ...updates } : p) });
  };

  const removePath = (pathId: string) => {
    const currentPaths = data.paths || [];
    updateNode(id, { paths: currentPaths.filter(p => p.id !== pathId) });
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-100 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b bg-gray-300 font-semibold text-gray-800 flex justify-between items-center">
        <span>Edit Node</span>
        <span className="text-xs px-2 py-1 bg-white/60 text-gray-700 rounded uppercase">{data.type}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-800">Label (Internal)</label>
          <input 
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white" 
            value={data.label} 
            onChange={(e) => updateNode(id, { label: e.target.value })}
          />
          
          <label className="block text-sm font-bold text-gray-800">Content / Question</label>
          <textarea 
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] text-gray-900 bg-white" 
            value={data.content} 
            onChange={(e) => updateNode(id, { content: e.target.value })}
          />
        </div>

        {/* Options (Radio/Checkbox) */}
        {(data.type === 'radio' || data.type === 'checkbox') && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-800">Options</label>
              <button onClick={addOption} className="text-xs flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {data.options?.map(opt => (
                <div key={opt.id} className="flex gap-2">
                  <input 
                    className="flex-1 p-1.5 text-sm border rounded text-gray-900 bg-white"
                    value={opt.label}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                  />
                  <button onClick={() => removeOption(opt.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checkbox Paths */}
        {data.type === 'checkbox' && (
          <div className="space-y-3 border-t border-gray-300 pt-4">
             <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-800">Output Paths</label>
              <button onClick={addPath} className="text-xs flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold">
                <Plus size={12} /> Add Path
              </button>
            </div>
            <p className="text-xs text-gray-600">Define which combination of selected options leads to which path. The system checks specific matches first.</p>
            <div className="space-y-4">
              {data.paths?.map(path => (
                <div key={path.id} className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex justify-between mb-2">
                     <input 
                        className="flex-1 p-1 text-xs border rounded bg-gray-50 font-medium text-gray-900"
                        value={path.label}
                        onChange={(e) => updatePath(path.id, { label: e.target.value })}
                        placeholder="Path Name"
                      />
                     <button onClick={() => removePath(path.id)} className="ml-2 text-red-500 hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-gray-500 font-bold">Requires (AND)</p>
                    {data.options?.map(opt => (
                      <label key={opt.id} className="flex items-center gap-2 text-xs text-gray-800">
                        <input 
                          type="checkbox"
                          checked={path.requiredOptionIds.includes(opt.id)}
                          onChange={(e) => {
                            const newReqs = e.target.checked 
                              ? [...path.requiredOptionIds, opt.id]
                              : path.requiredOptionIds.filter(rid => rid !== opt.id);
                            updatePath(path.id, { requiredOptionIds: newReqs });
                          }}
                        />
                        {opt.label}
                      </label>
                    ))}
                    {path.requiredOptionIds.length === 0 && (
                      <div className="text-[10px] text-gray-400 italic">No constraints = Default/Else path</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* End Node */}
        {data.type === 'end' && (
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="canRestart"
              checked={data.canRestart || false}
              onChange={(e) => updateNode(id, { canRestart: e.target.checked })}
            />
            <label htmlFor="canRestart" className="text-sm text-gray-800 font-medium">Allow Restart</label>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Viewer Component ---

const Viewer = ({ 
  nodes, 
  edges, 
  onExit 
}: { 
  nodes: AppNode[], 
  edges: Edge[], 
  onExit: () => void 
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>('start');
  const [selections, setSelections] = useState<string[]>([]); // Current node selections (option IDs)

  const currentNode = nodes.find(n => n.id === currentNodeId);

  // Incoming nodes (parents) - Purely based on graph topology
  const prevNodes = useMemo(() => {
    const incomingEdgeIds = edges.filter(e => e.target === currentNodeId).map(e => e.source);
    // Unique sources
    const uniqueSources = Array.from(new Set(incomingEdgeIds));
    return uniqueSources.map(id => nodes.find(n => n.id === id)).filter(Boolean) as AppNode[];
  }, [currentNodeId, edges, nodes]);

  // Outgoing nodes (children) - Purely based on graph topology
  const nextNodes = useMemo(() => {
    // For radio/checkbox, we need to look at specific handles, but for "Next" preview, 
    // we just show all possible distinct target nodes.
    const outgoingEdgeTargets = edges.filter(e => e.source === currentNodeId).map(e => e.target);
    const uniqueTargets = Array.from(new Set(outgoingEdgeTargets));
    return uniqueTargets.map(id => nodes.find(n => n.id === id)).filter(Boolean) as AppNode[];
  }, [currentNodeId, edges, nodes]);

  const handleBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevId = newHistory.pop();
    setHistory(newHistory);
    if (prevId) {
      setCurrentNodeId(prevId);
      setSelections([]); // Reset selections when going back
    }
  };

  const handleContinue = () => {
    if (!currentNode) return;

    if (currentNode.data.type === 'end') {
      if (currentNode.data.canRestart) {
        setHistory([]);
        setCurrentNodeId('start');
        setSelections([]);
      }
      return;
    }

    let nextEdge: Edge | undefined;

    if (currentNode.data.type === 'static') {
      // Just take the first edge
      nextEdge = edges.find(e => e.source === currentNodeId);
    } else if (currentNode.data.type === 'radio') {
      const selectedOptionId = selections[0];
      // Find edge connected to this source handle
      nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === selectedOptionId);
    } else if (currentNode.data.type === 'checkbox') {
      // Match selections against paths
      const paths = currentNode.data.paths || [];
      
      const sortedPaths = [...paths].sort((a, b) => {
        const lenDiff = b.requiredOptionIds.length - a.requiredOptionIds.length;
        if (lenDiff !== 0) return lenDiff;
        return a.label.localeCompare(b.label);
      });

      const matchedPath = sortedPaths.find(path => {
        // Only require logic: If I selected A and B, and path requires A, does it match?
        // Usually Exact Match or Subset Match.
        // Prompt said: "choose multiple ... and proceed to the node corresponding to combination"
        // Let's assume strict subset requirement: All requirements must be in selections. 
        // Note: If selections = [A, B] and Path1 req [A], Path2 req [A, B]. Sorted puts Path2 first.
        // If selections = [A, C] and Path1 req [A]. It matches.
        return path.requiredOptionIds.every(req => selections.includes(req));
      });

      if (matchedPath) {
        nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === matchedPath.id);
      }
    }

    if (nextEdge) {
      // Ensure target node exists
      const targetNode = nodes.find(n => n.id === nextEdge!.target);
      if (targetNode) {
        setHistory([...history, currentNodeId]);
        setCurrentNodeId(nextEdge.target);
        setSelections([]);
      } else {
        alert("Configuration Error: The next node is missing.");
      }
    } else {
      alert("No valid path defined for this selection.");
    }
  };

  const toggleSelection = (optId: string, isRadio: boolean) => {
    if (isRadio) {
      setSelections([optId]);
    } else {
      setSelections(prev => 
        prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]
      );
    }
  };

  if (!currentNode) return <div>Node not found</div>;

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-white border-b flex items-center px-6 justify-between shrink-0">
        <h2 className="font-bold text-gray-800">Preview Mode</h2>
        <button onClick={onExit} className="text-gray-600 hover:text-red-600 flex items-center gap-2">
          <Flag size={18} /> Exit
        </button>
      </div>

      {/* Main Wizard Layout */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
        
        {/* Connection Lines Layer (Conceptual) */}
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
            {prevNodes.length > 0 && <div className="w-[300px] h-[2px] bg-slate-400 absolute left-[25%]"></div>}
            {nextNodes.length > 0 && <div className="w-[300px] h-[2px] bg-slate-400 absolute right-[25%]"></div>}
        </div>

        <div className="w-full max-w-[90vw] grid grid-cols-3 gap-48 items-center h-full relative z-10">
          
          {/* LEFT COLUMN: Past */}
          <div className="flex flex-col items-end justify-center gap-4 opacity-80 transition-all duration-500">
             {prevNodes.length === 0 && <div className="text-sm text-gray-500 font-medium">Start of flow</div>}
             {prevNodes.map(node => (
               <div key={node.id} className="bg-white p-4 rounded-lg border border-gray-300 w-64 text-right shadow-sm">
                 <div className="text-xs uppercase font-bold text-gray-600 mb-1">{node.data.label}</div>
                 <div className="text-sm text-gray-900 line-clamp-2">{node.data.content}</div>
               </div>
             ))}
          </div>

          {/* CENTER COLUMN: Present (Active) */}
          <div className="flex flex-col items-center justify-center z-20">
             <div className="w-[450px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-500 transform scale-100">
                <div className={`h-2 w-full ${NODE_TYPES_CONFIG[currentNode.data.type].color.split(' ')[0].replace('bg-', 'bg-')}`} />
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-4 text-gray-500 text-sm font-bold uppercase tracking-wider">
                     {NODE_TYPES_CONFIG[currentNode.data.type].label}
                  </div>
                  
                  <h1 className="text-2xl font-bold text-gray-900 mb-6 leading-relaxed">
                    {currentNode.data.content}
                  </h1>

                  {/* Inputs */}
                  {(currentNode.data.type === 'radio' || currentNode.data.type === 'checkbox') && (
                    <div className="space-y-3 mb-8">
                       {currentNode.data.options?.map(opt => {
                         const isSelected = selections.includes(opt.id);
                         return (
                           <div 
                              key={opt.id}
                              onClick={() => toggleSelection(opt.id, currentNode.data.type === 'radio')}
                              className={`
                                p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3
                                ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 hover:border-gray-300 text-gray-800'}
                              `}
                           >
                             <div className={`
                               w-5 h-5 rounded-full border-2 flex items-center justify-center
                               ${currentNode.data.type === 'checkbox' ? 'rounded-md' : 'rounded-full'}
                               ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}
                             `}>
                               {isSelected && <Check size={12} className="text-white" />}
                             </div>
                             <span className="font-medium">{opt.label}</span>
                           </div>
                         );
                       })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-4 pt-4 border-t border-gray-100 mt-auto">
                     {history.length > 0 && (
                       <button 
                         onClick={handleBack}
                         className="flex-1 py-3 px-4 rounded-lg border-2 border-gray-300 font-bold text-gray-800 hover:bg-gray-100 flex items-center justify-center gap-2"
                       >
                         <ArrowLeft size={18} /> Back
                       </button>
                     )}
                     
                     {currentNode.data.type !== 'end' ? (
                       <button 
                         onClick={handleContinue}
                         disabled={currentNode.data.type !== 'static' && selections.length === 0}
                         className="flex-[2] py-3 px-4 rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                       >
                         Continue <ChevronRight size={18} />
                       </button>
                     ) : (
                       currentNode.data.canRestart && (
                         <button 
                          onClick={handleContinue}
                          className="flex-[2] py-3 px-4 rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700 flex items-center justify-center gap-2"
                         >
                           <RotateCcw size={18} /> Restart
                         </button>
                       )
                     )}
                  </div>
                </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Future (Preview) */}
          <div className="flex flex-col items-start justify-center gap-4 opacity-80 transition-all duration-500">
            {nextNodes.length === 0 && currentNode.data.type !== 'end' && <div className="text-sm text-gray-500 font-medium">End of path</div>}
            {nextNodes.map(node => (
               <div key={node.id} className="bg-white p-4 rounded-lg border border-gray-300 w-64 shadow-sm">
                 <div className="text-xs uppercase font-bold text-gray-600 mb-1">{node.data.label}</div>
                 <div className="text-sm text-gray-900 line-clamp-2">{node.data.content}</div>
               </div>
             ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const DraggableToolboxItem = ({ type }: { type: NodeType }) => {
  const config = NODE_TYPES_CONFIG[type];
  const Icon = config.icon;
  
  return (
    <div 
      className="group relative"
      onDragStart={(event) => event.dataTransfer.setData('application/reactflow', type)}
      draggable
    >
      <div className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded cursor-grab transition-colors flex items-center justify-center">
        <Icon size={24} />
      </div>
      
      {/* Tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
        <div className="font-bold mb-1">{config.label}</div>
        <div className="text-gray-300">{config.description}</div>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
      </div>
    </div>
  );
};

interface GitHubFile {
  name: string;
  download_url: string;
  type: 'file' | 'dir';
}

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mode, setMode] = useState<FlowMode>('editor');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modal State
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // Catalog State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<CatalogFolderConfig | null>(null);
  const [repoFiles, setRepoFiles] = useState<GitHubFile[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const { deleteElements, screenToFlowPosition } = useReactFlow<AppNode>();

  // Selection state for global delete
  const [selectedElements, setSelectedElements] = useState<{ nodes: AppNode[], edges: Edge[] }>({ nodes: [], edges: [] });

  useOnSelectionChange({
    onChange: ({ nodes, edges }) => {
      setSelectedElements({ nodes: nodes as AppNode[], edges });
      // Logic for Properties Panel selection
      if (nodes.length === 1) {
        setSelectedNodeId(nodes[0].id);
      } else if (nodes.length === 0) {
        setSelectedNodeId(null);
      }
    },
  });

  // Global Delete Handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Allow default behavior for inputs
      if (
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (['Delete', 'Backspace'].includes(event.key)) {
        if (selectedElements.nodes.length > 0 || selectedElements.edges.length > 0) {
          deleteElements({ nodes: selectedElements.nodes, edges: selectedElements.edges });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteElements, selectedElements]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AppNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
          label: `New ${NODE_TYPES_CONFIG[type].label}`, 
          content: 'Click to edit content...', 
          type,
          options: [],
          paths: []
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, screenToFlowPosition],
  );

  const updateNode = (id: string, newData: Partial<NodeData>) => {
    setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  };

  const handleLayout = () => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
  };

  const handleSave = () => {
    const data = JSON.stringify({ nodes, edges });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flowchart.json';
    link.click();
  };

  const loadFlowData = (data: any) => {
    if (data.nodes && Array.isArray(data.nodes) && data.edges && Array.isArray(data.edges)) {
      setNodes(data.nodes);
      setEdges(data.edges);
      return true;
    }
    return false;
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = JSON.parse(event.target?.result as string);
        if (!loadFlowData(result)) {
           alert('Invalid JSON file');
        }
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromUrl = () => {
    setShowUrlModal(true);
  };

  const executeUrlImport = async (url: string) => {
    if (!url) return;
    let urlToFetch = url.trim();

    // Fix common user error: Using GitHub blob link instead of raw
    if (urlToFetch.includes('github.com') && urlToFetch.includes('/blob/')) {
      urlToFetch = urlToFetch.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    try {
      const res = await fetch(urlToFetch);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      
      if (loadFlowData(data)) {
        return true;
      } else {
        alert('Invalid flowchart JSON structure.');
        return false;
      }
    } catch (error: any) {
      console.error(error);
      const isCors = error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'));
      let msg = `Import Failed: ${error.message}`;
      if (isCors) msg = `Network Error (CORS). ensure "raw" link used.`;
      alert(msg);
      return false;
    }
  };
  
  // Catalog Handlers
  const fetchFolderContents = async (folder: CatalogFolderConfig) => {
    setActiveFolder(folder);
    setLoadingCatalog(true);
    setRepoFiles([]);
    
    try {
      const url = `https://api.github.com/repos/${folder.owner}/${folder.repo}/contents/${folder.path}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
           // Filter for json files
           const files = data.filter((item: any) => item.type === 'file' && item.name.endsWith('.json'));
           setRepoFiles(files);
        } else {
           setRepoFiles([]);
           alert('Unexpected response from GitHub.');
        }
      } else {
        alert('Failed to load folder. Check configuration or rate limits.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error fetching catalog.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadCatalogFile = async (file: GitHubFile) => {
    setLoadingCatalog(true);
    const success = await executeUrlImport(file.download_url);
    setLoadingCatalog(false);
    if (success) {
      setIsCatalogOpen(false); // Close sidebar on success
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-gray-50 relative">
      
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 relative shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">F</div>
            <h1 className="font-bold text-gray-900 hidden sm:block">FlowBuilder</h1>
          </div>
          
          <button 
             onClick={() => setIsCatalogOpen(!isCatalogOpen)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isCatalogOpen ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
             <Book size={16} /> Catalog
          </button>
        </div>

        {/* Toolbox Area */}
        <div className="flex items-center justify-center gap-4 mx-4 flex-1">
          <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-2 border border-gray-200">
             <DraggableToolboxItem type="static" />
             <DraggableToolboxItem type="radio" />
             <DraggableToolboxItem type="checkbox" />
             <DraggableToolboxItem type="end" />
          </div>
          <span className="text-xs text-gray-400 font-medium hidden lg:inline">Drag items to canvas</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={handleLayout} title="Auto Layout" className="p-2 text-gray-700 hover:bg-gray-100 rounded text-sm flex gap-1 font-medium transition-colors">
             <Layout size={18} />
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <label title="Import from File" className="p-2 text-gray-700 hover:bg-gray-100 rounded cursor-pointer text-sm flex gap-1 items-center font-medium transition-colors">
            <Upload size={18} />
            <input type="file" accept=".json" onChange={handleLoad} className="hidden" />
          </label>
          <button onClick={handleImportFromUrl} title="Import from URL" className="p-2 text-gray-700 hover:bg-gray-100 rounded text-sm flex gap-1 items-center font-medium transition-colors">
            <LinkIcon size={18} />
          </button>
          <button onClick={handleSave} title="Save" className="p-2 text-gray-700 hover:bg-gray-100 rounded text-sm flex gap-1 items-center font-medium transition-colors">
            <Save size={18} />
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button 
            onClick={() => setMode('viewer')} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <Play size={16} /> <span className="hidden sm:inline">Run Flow</span>
          </button>
        </div>
      </header>

      {/* Catalog Sidebar */}
      <div 
        className={`absolute top-16 left-0 bottom-0 bg-white shadow-xl border-r border-gray-200 z-30 transition-all duration-300 ease-in-out flex flex-col ${isCatalogOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'}`}
      >
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
           <h3 className="font-bold text-gray-800 flex items-center gap-2">
             {activeFolder ? (
               <button onClick={() => setActiveFolder(null)} className="hover:bg-gray-200 p-1 rounded"><ArrowLeft size={16}/></button>
             ) : <Book size={18}/>}
             {activeFolder ? activeFolder.name : 'Catalog Folders'}
           </h3>
           <button onClick={() => setIsCatalogOpen(false)}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loadingCatalog ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
               <Loader2 className="animate-spin mb-2" />
               <span className="text-xs">Loading contents...</span>
            </div>
          ) : (
             <>
               {/* Folder List View */}
               {!activeFolder && (
                 <div className="space-y-2">
                   {CATALOG_FOLDERS.map(folder => (
                     <div 
                        key={folder.id} 
                        onClick={() => fetchFolderContents(folder)}
                        className="p-3 rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-3 group"
                      >
                        <div className="p-2 bg-blue-100 text-blue-600 rounded group-hover:bg-blue-200">
                           <Folder size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{folder.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">{folder.owner}/{folder.repo}</div>
                        </div>
                        <ChevronRight size={16} className="ml-auto text-gray-400 group-hover:text-blue-500"/>
                     </div>
                   ))}
                 </div>
               )}

               {/* File List View */}
               {activeFolder && (
                 <div className="space-y-2">
                    {repoFiles.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-8 italic">No .json files found in this folder.</div>
                    ) : (
                      repoFiles.map(file => (
                        <div 
                          key={file.name}
                          onClick={() => loadCatalogFile(file)}
                          className="p-3 rounded border border-gray-200 hover:border-green-400 hover:bg-green-50 cursor-pointer transition-colors flex items-center gap-3 group"
                        >
                          <div className="p-2 bg-green-100 text-green-600 rounded group-hover:bg-green-200">
                             <FileJson size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="font-semibold text-gray-800 text-sm truncate">{file.name}</div>
                          </div>
                        </div>
                      ))
                    )}
                 </div>
               )}
             </>
          )}
        </div>
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 text-center">
           Edit CATALOG_FOLDERS in index.tsx to add your own repos.
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1 h-full bg-slate-50 relative">
          <ReactFlow<AppNode>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background color="#cbd5e1" gap={20} />
            <Controls />
            <MiniMap className="bg-white border rounded shadow-lg" zoomable pannable />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {selectedNodeId && (
          <PropertiesPanel selectedNode={selectedNode} updateNode={updateNode} />
        )}
      </div>

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Import from URL</h3>
              <button onClick={() => setShowUrlModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-3">
                Enter a direct link to a raw JSON file containing the flowchart data.
              </p>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm mb-4"
                placeholder="https://example.com/flowchart.json"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    executeUrlImport(importUrl).then(success => {
                       if(success) { setShowUrlModal(false); setImportUrl(''); }
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Overlay */}
      {mode === 'viewer' && (
        <Viewer nodes={nodes} edges={edges} onExit={() => setMode('editor')} />
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>
);