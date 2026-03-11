import React, { useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_TYPES_CONFIG } from '../flow/config';
import { NodeData, NodeType, ThemeModeContext } from '../flow/types';

const NodeHeader = ({ type, label }: { type: NodeType; label: string }) => {
  const Icon = NODE_TYPES_CONFIG[type].icon;
  const isDarkMode = useContext(ThemeModeContext);
  return (
    <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDarkMode ? 'border-slate-700/80' : 'border-gray-200/50'}`}>
      <Icon size={14} className={isDarkMode ? 'text-slate-300' : 'text-gray-600'} />
      <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>{label}</span>
    </div>
  );
};

const StaticNodeComponent = ({ data, id }: { data: NodeData; id: string }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[280px] text-sm h-full ${isDarkMode ? 'bg-slate-900 border border-slate-700' : ''}`}>
    {id !== 'start' && <Handle type="target" position={Position.Left} className="!bg-gray-400" />}
    <NodeHeader type="static" label={data.label} />
    <p className={isDarkMode ? 'text-slate-100 line-clamp-3' : 'text-gray-800 line-clamp-3'}>{data.content}</p>
    <Handle type="source" position={Position.Right} className="!bg-blue-500" />
  </div>
  );
};

const EndNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[280px] text-sm h-full ${isDarkMode ? 'bg-red-950/20 border border-red-900/40' : 'bg-red-50/50'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="end" label={data.label} />
    <p className={isDarkMode ? 'text-slate-100 mb-2' : 'text-gray-800 mb-2'}>{data.content}</p>
    {data.canRestart && <div className={isDarkMode ? 'text-xs text-blue-300 font-medium' : 'text-xs text-blue-700 font-medium'}>↺ Can Restart</div>}
  </div>
  );
};

const RadioNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[300px] text-sm relative h-full ${isDarkMode ? 'bg-blue-950/20 border border-blue-900/40' : 'bg-blue-50/50'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="radio" label={data.label} />
    <p className={isDarkMode ? 'text-slate-100 mb-3 italic' : 'text-gray-800 mb-3 italic'}>{data.content}</p>
    <div className="space-y-2">
      {data.options?.map((opt, idx) => (
        <div key={opt.id} className={`relative flex items-center justify-between p-2 rounded ${isDarkMode ? 'bg-slate-900 border border-blue-900/50 text-slate-100' : 'bg-white border border-blue-100 text-gray-800'}`}>
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
};

const CheckboxNodeComponent = ({ data }: { data: NodeData }) => {
  const isDarkMode = useContext(ThemeModeContext);
  return (
  <div className={`p-4 rounded-lg w-[320px] text-sm h-full ${isDarkMode ? 'bg-purple-950/20 border border-purple-900/40' : 'bg-purple-50/50'}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-400" />
    <NodeHeader type="checkbox" label={data.label} />
    <p className={isDarkMode ? 'text-slate-100 mb-3 italic' : 'text-gray-800 mb-3 italic'}>{data.content}</p>
    
    <div className={isDarkMode ? 'mb-2 text-xs font-bold text-purple-200' : 'mb-2 text-xs font-bold text-purple-900'}>Available Options:</div>
    <div className="flex flex-wrap gap-1 mb-4">
      {data.options?.map(opt => (
        <span key={opt.id} className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-slate-900 border border-purple-900/50 text-slate-100' : 'bg-white border border-purple-100 text-gray-800'}`}>{opt.label}</span>
      ))}
    </div>

    <div className={isDarkMode ? 'mb-2 text-xs font-bold text-purple-200' : 'mb-2 text-xs font-bold text-purple-900'}>Logic Paths (Outputs):</div>
    <div className="space-y-2">
      {data.paths?.map((path) => (
        <div key={path.id} className={`relative flex items-center justify-between p-2 rounded ${isDarkMode ? 'bg-slate-900 border border-purple-900/50 text-slate-100' : 'bg-white border border-purple-100 text-gray-800'}`}>
          <div className="flex flex-col">
             <span className="font-medium">{path.label}</span>
             <span className={isDarkMode ? 'text-xs text-slate-400 mt-0.5' : 'text-xs text-gray-600 mt-0.5'}>
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
};

const nodeTypes = {
  radio: RadioNodeComponent,
  checkbox: CheckboxNodeComponent,
  static: StaticNodeComponent,
  end: EndNodeComponent,
};


export { nodeTypes };
