import React, { useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CircleHelp, ExternalLink, Image as ImageIcon, Table as TableIcon } from 'lucide-react';
import { NODE_TYPES_CONFIG } from '../flow/config';
import { NodeData, NodeType, ThemeModeContext } from '../flow/types';

const isFeatureEnabled = (data: NodeData, key: keyof NonNullable<NodeData['features']>) => data.features?.[key] !== false;

const HintBadge = ({ hint }: { hint?: string }) => {
  if (!hint) return null;
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help">
      <CircleHelp size={13} className="opacity-70" />
      <span className="pointer-events-none absolute z-20 hidden group-hover:block left-4 top-4 w-56 rounded bg-slate-800 text-white text-xs p-2 shadow-lg">
        {hint}
      </span>
    </span>
  );
};

const NodeHeader = ({ type, data }: { type: NodeType; data: NodeData }) => {
  const Icon = NODE_TYPES_CONFIG[type].icon;
  const isDarkMode = useContext(ThemeModeContext);
  return (
    <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDarkMode ? 'border-slate-700/80' : 'border-gray-200/50'}`}>
      <Icon size={14} className={isDarkMode ? 'text-slate-300' : 'text-gray-600'} />
      <span className={`text-xs font-bold uppercase tracking-wider flex items-center ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
        {data.label}
        {isFeatureEnabled(data, 'enableTitleHint') && <HintBadge hint={data.titleHint} />}
      </span>
    </div>
  );
};

const AdditionalContentPreview = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  if (!isFeatureEnabled(data, 'enableAdditionalContent') || !data.additionalContent?.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {data.additionalContent.map((block) => (
        <div key={block.id} className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
          {block.type === 'table' && <TableIcon size={12} />}
          {block.type === 'image' && <ImageIcon size={12} />}
          {block.type === 'link' && <ExternalLink size={12} />}
          <span>{block.title}</span>
        </div>
      ))}
    </div>
  );
};

const StaticNodeComponent = ({ data, id }: { data: NodeData; id: string }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[280px] text-sm h-full ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
    {id !== 'start' && <Handle type="target" position={Position.Left} className="!bg-gray-400" />}
    <NodeHeader type="static" data={data} />
    <p className={isDarkMode ? 'text-slate-100 line-clamp-3' : 'text-gray-800 line-clamp-3'}>{data.content}</p>
    <AdditionalContentPreview data={data} />
    <Handle type="source" position={Position.Right} className="!bg-blue-500" />
  </div>
  );
};

const EndNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[280px] text-sm h-full ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="end" data={data} />
    <p className={isDarkMode ? 'text-slate-100 mb-2' : 'text-gray-800 mb-2'}>{data.content}</p>
    {data.canRestart && <div className={isDarkMode ? 'text-xs text-blue-300 font-medium' : 'text-xs text-blue-700 font-medium'}>↺ Can Restart</div>}
    <AdditionalContentPreview data={data} />
  </div>
  );
};

const renderOptionsTable = (data: NodeData, isDarkMode: boolean, allowHandles: boolean) => {
  const columns = Math.max(1, data.tableConfig?.columns || 2);
  const cells = data.tableConfig?.cells || [];
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {cells.map((cell) => {
        const isLegend = !!cell.isLegend;
        return (
          <div key={cell.id} className={`relative p-2 rounded text-xs border ${isLegend ? 'opacity-70 italic' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-800'}`}>
            <span className="flex items-center">{cell.label}<HintBadge hint={cell.hint} /></span>
            {allowHandles && !isLegend && cell.optionId && (
              <Handle type="source" position={Position.Right} id={cell.optionId} style={{ top: '50%', right: '-24px' }} className="!bg-blue-500" />
            )}
          </div>
        );
      })}
    </div>
  );
};

const RadioNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  const tableMode = isFeatureEnabled(data, 'enableTableLayout') && !!data.tableConfig?.cells?.length;

  return (
  <div className={`p-4 rounded-lg w-[300px] text-sm relative h-full ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="radio" data={data} />
    <p className={isDarkMode ? 'text-slate-100 mb-3 italic' : 'text-gray-800 mb-3 italic'}>{data.content}</p>
    {tableMode ? renderOptionsTable(data, isDarkMode, true) : (
      <div className="space-y-2">
        {data.options?.map((opt) => (
          <div key={opt.id} className={`relative flex items-center justify-between p-2 rounded ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white border border-gray-200 text-gray-800'}`}>
            <span className="flex items-center">{opt.label}{isFeatureEnabled(data, 'enableOptionHints') && <HintBadge hint={opt.hint} />}</span>
            <Handle type="source" position={Position.Right} id={opt.id} style={{ top: '50%', right: '-24px' }} className="!bg-blue-500" />
          </div>
        ))}
        {(!data.options || data.options.length === 0) && <div className="text-red-600 text-xs font-medium">No options defined</div>}
      </div>
    )}
    <AdditionalContentPreview data={data} />
  </div>
  );
};

const CheckboxNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  const tableMode = isFeatureEnabled(data, 'enableTableLayout') && !!data.tableConfig?.cells?.length;

  return (
  <div className={`p-4 rounded-lg w-[320px] text-sm h-full ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="checkbox" data={data} />
    <p className={isDarkMode ? 'text-slate-100 mb-3 italic' : 'text-gray-800 mb-3 italic'}>{data.content}</p>

    {tableMode ? renderOptionsTable(data, isDarkMode, false) : (
      <>
        <div className={isDarkMode ? 'mb-2 text-xs font-bold text-slate-200' : 'mb-2 text-xs font-bold text-gray-700'}>Available Options:</div>
        <div className="flex flex-wrap gap-1 mb-4">
          {data.options?.map(opt => (
            <span key={opt.id} className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white border border-gray-200 text-gray-800'}`}>{opt.label}</span>
          ))}
        </div>
      </>
    )}

    <div className={isDarkMode ? 'mb-2 text-xs font-bold text-slate-200' : 'mb-2 text-xs font-bold text-gray-700'}>Logic Paths (Outputs):</div>
    <div className="space-y-2">
      {data.paths?.map((path) => (
        <div key={path.id} className={`relative flex items-center justify-between p-2 rounded ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white border border-gray-200 text-gray-800'}`}>
          <div className="flex flex-col">
             <span className="font-medium">{path.label}</span>
             <span className={isDarkMode ? 'text-xs text-slate-400 mt-0.5' : 'text-xs text-gray-600 mt-0.5'}>
               Requires: {path.requiredOptionIds.length > 0
                  ? path.requiredOptionIds.map(id => data.options?.find(o => o.id === id)?.label || '???').join(' + ')
                  : '(Any/Else)'}
             </span>
          </div>
          <Handle type="source" position={Position.Right} id={path.id} style={{ top: '50%', right: '-24px' }} className="!bg-blue-500" />
        </div>
      ))}
    </div>
    <AdditionalContentPreview data={data} />
  </div>
  );
};

const nodeTypes = {
  radio: RadioNodeComponent,
  checkbox: CheckboxNodeComponent,
  static: StaticNodeComponent,
  end: EndNodeComponent,
};

export { nodeTypes };
