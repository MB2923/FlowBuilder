import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Flag, RotateCcw, X } from 'lucide-react';
import { Edge } from '@xyflow/react';
import { AppNode } from '../flow/types';
import { NODE_TYPES_CONFIG } from '../flow/config';

const Viewer = ({ 
  nodes, 
  edges, 
  onExit,
  isDarkMode,
}: { 
  nodes: AppNode[], 
  edges: Edge[], 
  onExit: () => void,
  isDarkMode: boolean,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>('start');
  const [selections, setSelections] = useState<string[]>([]); // Current node selections (option IDs)

  const nodesById = useMemo(() => {
    const map = new Map<string, AppNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const { incomingByTarget, outgoingBySource } = useMemo(() => {
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();

    edges.forEach((edge) => {
      const incomingSources = incoming.get(edge.target) || [];
      incomingSources.push(edge.source);
      incoming.set(edge.target, incomingSources);

      const outgoingTargets = outgoing.get(edge.source) || [];
      outgoingTargets.push(edge.target);
      outgoing.set(edge.source, outgoingTargets);
    });

    return {
      incomingByTarget: incoming,
      outgoingBySource: outgoing,
    };
  }, [edges]);

  const currentNode = nodesById.get(currentNodeId);

  // Incoming nodes (parents) - Purely based on graph topology
  const prevNodes = useMemo(() => {
    const incomingSources = incomingByTarget.get(currentNodeId) || [];
    const uniqueSources = Array.from(new Set(incomingSources));

    return uniqueSources
      .map((id) => nodesById.get(id))
      .filter(Boolean) as AppNode[];
  }, [currentNodeId, incomingByTarget, nodesById]);

  // Outgoing nodes (children) - Purely based on graph topology
  const nextNodes = useMemo(() => {
    const outgoingTargets = outgoingBySource.get(currentNodeId) || [];
    const uniqueTargets = Array.from(new Set(outgoingTargets));

    return uniqueTargets
      .map((id) => nodesById.get(id))
      .filter(Boolean) as AppNode[];
  }, [currentNodeId, outgoingBySource, nodesById]);

  const handleBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevId = newHistory.pop();
    setHistory(newHistory);
    if (prevId) {
      setCurrentNodeId(prevId);
      setSelections([]);
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
      nextEdge = edges.find(e => e.source === currentNodeId);
    } else if (currentNode.data.type === 'radio') {
      const selectedOptionId = selections[0];
      nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === selectedOptionId);
    } else if (currentNode.data.type === 'checkbox') {
      const paths = currentNode.data.paths || [];

      const sortedPaths = [...paths].sort((a, b) => {
        const lenDiff = b.requiredOptionIds.length - a.requiredOptionIds.length;
        if (lenDiff !== 0) return lenDiff;
        return a.label.localeCompare(b.label);
      });

      const matchedPath = sortedPaths.find(path => path.requiredOptionIds.every(req => selections.includes(req)));

      if (matchedPath) {
        nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === matchedPath.id);
      }
    }

    if (nextEdge) {
      const targetNode = nodesById.get(nextEdge.target);
      if (targetNode) {
        setHistory([...history, currentNodeId]);
        setCurrentNodeId(nextEdge.target);
        setSelections([]);
      } else {
        alert('Configuration Error: The next node is missing.');
      }
    } else {
      alert('No valid path defined for this selection.');
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
    <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`h-16 border-b flex items-center px-6 justify-between shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
        <h2 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Preview Mode</h2>
        <button onClick={onExit} className={`flex items-center gap-2 ${isDarkMode ? 'text-slate-300 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}>
          <Flag size={18} /> Exit
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
          {prevNodes.length > 0 && <div className={`w-[300px] h-[2px] absolute left-[25%] ${isDarkMode ? 'bg-slate-600' : 'bg-slate-400'}`}></div>}
          {nextNodes.length > 0 && <div className={`w-[300px] h-[2px] absolute right-[25%] ${isDarkMode ? 'bg-slate-600' : 'bg-slate-400'}`}></div>}
        </div>

        <div className="w-full max-w-[90vw] grid grid-cols-3 gap-48 items-center h-full relative z-10">
          <div className="flex flex-col items-end justify-center gap-4 opacity-80 transition-all duration-500">
            {prevNodes.length === 0 && <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Start of flow</div>}
            {prevNodes.map(node => (
              <div key={node.id} className={`p-4 rounded-lg border w-64 text-right shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
                <div className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>{node.data.label}</div>
                <div className={`text-sm line-clamp-2 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>{node.data.content}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center z-20">
            <div className={`w-[450px] rounded-xl shadow-2xl border overflow-hidden flex flex-col transition-all duration-500 transform scale-100 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
              <div className={`h-2 w-full ${NODE_TYPES_CONFIG[currentNode.data.type].color.split(' ')[0].replace('bg-', 'bg-')}`} />
              <div className="p-8">
                <div className={`flex items-center gap-2 mb-4 text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {NODE_TYPES_CONFIG[currentNode.data.type].label}
                </div>

                <h1 className={`text-2xl font-bold mb-6 leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                  {currentNode.data.content}
                </h1>

                {currentNode.data.type === 'radio' && (
                  <div className="space-y-3 mb-8">
                    {currentNode.data.options?.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => toggleSelection(opt.id, true)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selections.includes(opt.id)
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                            : isDarkMode
                              ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                              : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {currentNode.data.type === 'checkbox' && (
                  <div className="space-y-3 mb-8">
                    {currentNode.data.options?.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => toggleSelection(opt.id, false)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selections.includes(opt.id)
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : isDarkMode
                              ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                              : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-gray-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {currentNode.data.type === 'end' && (
                  <div className={`mb-8 p-4 rounded-lg border ${isDarkMode ? 'bg-green-950/20 border-green-900/50 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                    <Check size={18} className="inline mr-2" /> End of flow reached
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  {history.length > 0 && (
                    <button
                      onClick={handleBack}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-bold flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-600 text-slate-100 hover:bg-slate-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
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

          <div className="flex flex-col items-start justify-center gap-4 opacity-80 transition-all duration-500">
            {nextNodes.length === 0 && currentNode.data.type !== 'end' && <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>End of path</div>}
            {nextNodes.map(node => (
              <div key={node.id} className={`p-4 rounded-lg border w-64 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
                <div className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>{node.data.label}</div>
                <div className={`text-sm line-clamp-2 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>{node.data.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


export { Viewer };
