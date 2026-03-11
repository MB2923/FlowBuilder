import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Copy, Flag, RotateCcw } from 'lucide-react';
import { Edge } from '@xyflow/react';
import { AppNode, TableCell } from '../flow/types';
import { NODE_TYPES_CONFIG } from '../flow/config';

const defaultFeatures = {
  enableTitleHint: true,
  enableOptionHints: true,
  enableAdditionalContent: true,
  enableTableLayout: false,
  enableCopyButton: true,
};

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
  const [selections, setSelections] = useState<string[]>([]);
  const [openedHints, setOpenedHints] = useState<Record<string, boolean>>({});

  const nodesById = useMemo(() => {
    const map = new Map<string, AppNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const { incomingByTarget, outgoingBySource } = useMemo(() => {
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    edges.forEach((edge) => {
      incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]);
      outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
    });
    return { incomingByTarget: incoming, outgoingBySource: outgoing };
  }, [edges]);

  const currentNode = nodesById.get(currentNodeId);

  const prevNodes = useMemo(() => ((incomingByTarget.get(currentNodeId) || []).map((id) => nodesById.get(id)).filter(Boolean) as AppNode[]), [currentNodeId, incomingByTarget, nodesById]);
  const nextNodes = useMemo(() => ((outgoingBySource.get(currentNodeId) || []).map((id) => nodesById.get(id)).filter(Boolean) as AppNode[]), [currentNodeId, outgoingBySource, nodesById]);

  const handleBack = () => {
    const prevId = history[history.length - 1];
    if (!prevId) return;
    setHistory(history.slice(0, -1));
    setCurrentNodeId(prevId);
    setSelections([]);
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
      nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === selections[0]);
    } else if (currentNode.data.type === 'checkbox') {
      const sortedPaths = [...(currentNode.data.paths || [])].sort((a, b) => b.requiredOptionIds.length - a.requiredOptionIds.length);
      const matchedPath = sortedPaths.find(path => path.requiredOptionIds.every(req => selections.includes(req)));
      if (matchedPath) nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === matchedPath.id);
    }

    if (!nextEdge) return alert('No valid path defined for this selection.');
    setHistory([...history, currentNodeId]);
    setCurrentNodeId(nextEdge.target);
    setSelections([]);
  };

  const toggleSelection = (optId: string, isRadio: boolean) => {
    setSelections((prev) => isRadio ? [optId] : (prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]));
  };

  const copyNodeText = async () => {
    if (!currentNode) return;
    const extra = (currentNode.data.additionalContent || []).map((b) => `${b.title}: ${b.type === 'table' ? b.markdown : b.url}`).join('\n');
    const text = `${currentNode.data.content}${extra ? `\n\n${extra}` : ''}`;
    await navigator.clipboard.writeText(text);
  };

  const renderHints = (id: string, hint?: string) => {
    if (!hint) return null;
    return (
      <>
        <button className="text-xs underline ml-2" onClick={() => setOpenedHints((prev) => ({ ...prev, [id]: !prev[id] }))}>подсказка</button>
        {openedHints[id] && <div className={`mt-1 p-2 rounded text-xs ${isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-blue-50 text-gray-700'}`}>{hint}</div>}
      </>
    );
  };

  const renderTableOptions = (cells: TableCell[], columns: number, isRadio: boolean) => (
    <div className="grid gap-2 mb-8" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0,1fr))` }}>
      {cells.map((cell) => {
        const isLegend = !!cell.isLegend;
        const selected = !!cell.optionId && selections.includes(cell.optionId);
        return (
          <button
            key={cell.id}
            disabled={isLegend || !cell.optionId}
            onClick={() => cell.optionId && toggleSelection(cell.optionId, isRadio)}
            className={`text-left p-3 rounded-lg border-2 transition-all ${isLegend ? 'opacity-70 italic cursor-default' : ''} ${selected ? 'border-blue-500 bg-blue-500/10 text-blue-300' : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 text-gray-800'}`}
          >
            {cell.label}
            {renderHints(cell.id, cell.hint)}
          </button>
        );
      })}
    </div>
  );

  const renderAdditionalContent = () => {
    if (!currentNode || !defaultFeatures.enableAdditionalContent || currentNode.data.features?.enableAdditionalContent === false) return null;
    return (
      <div className="space-y-3 mb-6">
        {currentNode.data.additionalContent?.map((block) => (
          <div key={block.id} className={`rounded border p-3 text-sm ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
            <div className="font-semibold mb-1">{block.title}</div>
            {block.type === 'link' && <a href={block.url} target="_blank" rel="noreferrer" className="underline text-blue-500">{block.url}</a>}
            {block.type === 'image' && <img src={block.url} alt={block.title} className="max-h-52 rounded" />}
            {block.type === 'table' && <pre className="whitespace-pre-wrap text-xs">{block.markdown}</pre>}
          </div>
        ))}
      </div>
    );
  };

  if (!currentNode) return <div>Node not found</div>;
  const features = { ...defaultFeatures, ...(currentNode.data.features || {}) };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`h-16 border-b flex items-center px-6 justify-between shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
        <h2 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Preview Mode</h2>
        <button onClick={onExit} className={`flex items-center gap-2 ${isDarkMode ? 'text-slate-300 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}><Flag size={18} /> Exit</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
        <div className="w-full max-w-[90vw] grid grid-cols-3 gap-20 items-center h-full relative z-10">
          <div className="flex flex-col items-end justify-center gap-4 opacity-80">{prevNodes.map(node => <div key={node.id} className={`p-4 rounded-lg border w-64 text-right ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>{node.data.label}</div>)}</div>

          <div className="flex flex-col items-center justify-center z-20">
            <div className={`w-[520px] rounded-xl shadow-2xl border overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
              <div className={`h-2 w-full ${NODE_TYPES_CONFIG[currentNode.data.type].color.split(' ')[0]}`} />
              <div className="p-8">
                <div className={`text-sm font-bold uppercase mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{NODE_TYPES_CONFIG[currentNode.data.type].label}</div>
                <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>{currentNode.data.content}</h1>
                {features.enableTitleHint && renderHints(`title-${currentNode.id}`, currentNode.data.titleHint)}

                {features.enableAdditionalContent && renderAdditionalContent()}

                {currentNode.data.type === 'radio' && (
                  features.enableTableLayout && currentNode.data.tableConfig?.cells?.length
                    ? renderTableOptions(currentNode.data.tableConfig.cells, currentNode.data.tableConfig.columns, true)
                    : <div className="space-y-3 mb-8">{currentNode.data.options?.map(opt => <button key={opt.id} onClick={() => toggleSelection(opt.id, true)} className={`w-full text-left p-3 rounded-lg border-2 ${selections.includes(opt.id) ? 'border-blue-500 bg-blue-500/10 text-blue-300' : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 text-gray-800'}`}>{opt.label}{features.enableOptionHints && renderHints(opt.id, opt.hint)}</button>)}</div>
                )}

                {currentNode.data.type === 'checkbox' && (
                  features.enableTableLayout && currentNode.data.tableConfig?.cells?.length
                    ? renderTableOptions(currentNode.data.tableConfig.cells, currentNode.data.tableConfig.columns, false)
                    : <div className="space-y-3 mb-8">{currentNode.data.options?.map(opt => <button key={opt.id} onClick={() => toggleSelection(opt.id, false)} className={`w-full text-left p-3 rounded-lg border-2 ${selections.includes(opt.id) ? 'border-purple-500 bg-purple-500/10 text-purple-300' : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 text-gray-800'}`}>{opt.label}{features.enableOptionHints && renderHints(opt.id, opt.hint)}</button>)}</div>
                )}

                {currentNode.data.type === 'end' && <div className={`mb-8 p-4 rounded-lg border ${isDarkMode ? 'bg-green-950/20 border-green-900/50 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}><Check size={18} className="inline mr-2" /> End of flow reached</div>}

                <div className="flex gap-3 mt-4">
                  {history.length > 0 && <button onClick={handleBack} className={`flex-1 py-3 px-4 rounded-lg border-2 ${isDarkMode ? 'border-slate-600 text-slate-100' : 'border-gray-300 text-gray-800'}`}><ArrowLeft size={18} className="inline mr-2" />Back</button>}
                  {features.enableCopyButton && <button onClick={copyNodeText} className="py-3 px-4 rounded-lg border-2 border-emerald-500 text-emerald-500"><Copy size={16} /></button>}
                  {currentNode.data.type !== 'end' ? <button onClick={handleContinue} disabled={currentNode.data.type !== 'static' && selections.length === 0} className="flex-[2] py-3 px-4 rounded-lg bg-blue-600 text-white disabled:opacity-50">Continue <ChevronRight size={18} className="inline" /></button> : currentNode.data.canRestart && <button onClick={handleContinue} className="flex-[2] py-3 px-4 rounded-lg bg-green-600 text-white"><RotateCcw size={18} className="inline mr-2" />Restart</button>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start justify-center gap-4 opacity-80">{nextNodes.map(node => <div key={node.id} className={`p-4 rounded-lg border w-64 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>{node.data.label}</div>)}</div>
        </div>
      </div>
    </div>
  );
};

export { Viewer };
