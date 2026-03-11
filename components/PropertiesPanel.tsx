import React, { useContext } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { AppNode, LogicPath, NodeData, ThemeModeContext } from '../flow/types';

const PropertiesPanel = ({ selectedNode, updateNode }: { selectedNode: AppNode | null, updateNode: (id: string, data: Partial<NodeData>) => void }) => {
  const isDarkMode = useContext(ThemeModeContext);
  if (!selectedNode) return (
    <div className={`w-80 border-l p-4 flex flex-col items-center justify-center text-center ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-gray-200 bg-gray-100 text-gray-500'}`}>
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
    <div className={`w-80 border-l flex flex-col h-full overflow-hidden ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-100'}`}>
      <div className={`p-4 border-b font-semibold flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'bg-gray-300 text-gray-800'}`}>
        <span>Edit Node</span>
        <span className={`text-xs px-2 py-1 rounded uppercase ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-white/60 text-gray-700'}`}>{data.type}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Label (Internal)</label>
          <input 
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} 
            value={data.label} 
            onChange={(e) => updateNode(id, { label: e.target.value })}
          />
          
          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Content / Question</label>
          <textarea 
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} 
            value={data.content} 
            onChange={(e) => updateNode(id, { content: e.target.value })}
          />
        </div>

        {/* Options (Radio/Checkbox) */}
        {(data.type === 'radio' || data.type === 'checkbox') && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Options</label>
              <button onClick={addOption} className={`text-xs flex items-center gap-1 font-semibold ${isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-900'}`}>
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {data.options?.map(opt => (
                <div key={opt.id} className="flex gap-2">
                  <input 
                    className={`flex-1 p-1.5 text-sm border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`}
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
          <div className={`space-y-3 border-t pt-4 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
             <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Output Paths</label>
              <button onClick={addPath} className={`text-xs flex items-center gap-1 font-semibold ${isDarkMode ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'}`}>
                <Plus size={12} /> Add Path
              </button>
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>Define which combination of selected options leads to which path. The system checks specific matches first.</p>
            <div className="space-y-4">
              {data.paths?.map(path => (
                <div key={path.id} className={`p-3 rounded border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between mb-2">
                     <input 
                        className={`flex-1 p-1 text-xs border rounded font-medium ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                        value={path.label}
                        onChange={(e) => updatePath(path.id, { label: e.target.value })}
                        placeholder="Path Name"
                      />
                     <button onClick={() => removePath(path.id)} className="ml-2 text-red-500 hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                  </div>
                  <div className="space-y-1">
                    <p className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Requires (AND)</p>
                    {data.options?.map(opt => (
                      <label key={opt.id} className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
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
                      <div className={`text-[10px] italic ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>No constraints = Default/Else path</div>
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
            <label htmlFor="canRestart" className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Allow Restart</label>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Viewer Component ---


export { PropertiesPanel };
