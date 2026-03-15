import React, { useContext, useEffect, useState } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { AdditionalContentBlock, AppNode, LogicPath, NodeData, TableCell, ThemeModeContext } from '../flow/types';
import { Language } from '../flow/i18n';
import { getTableCellClasses, getTableGridTemplateColumns } from './tableLayoutStyles';

const defaultFeatures = {
  enableTitleHint: true,
  enableOptionHints: true,
  enableAdditionalContent: true,
  enableTableLayout: false,
  enableCopyButton: true,
};

const panelLocale = {
  en: {
    add: 'Add',
    initFromOptions: 'Init from options',
    addOptionCell: '+ Option cell',
    addLegendCell: '+ Legend cell',
    cellLegendType: 'legend',
    cellOptionType: 'option',
    legendCell: 'Legend cell',
  },
  ru: {
    add: 'Добавить',
    initFromOptions: 'Создать из вариантов',
    addOptionCell: '+ Ячейка варианта',
    addLegendCell: '+ Ячейка легенды',
    cellLegendType: 'легенда',
    cellOptionType: 'вариант',
    legendCell: 'Ячейка легенды',
  },
} as const;

const PropertiesPanel = ({ selectedNode, updateNode, language, className = '' }: { selectedNode: AppNode | null, updateNode: (id: string, data: Partial<NodeData>) => void, language: Language, className?: string }) => {
  const isDarkMode = useContext(ThemeModeContext);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const panelText = panelLocale[language];

  if (!selectedNode) return (
    <div className={`w-full border-l p-4 flex flex-col items-center justify-center text-center ${className} ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-gray-200 bg-gray-100 text-gray-500'}`}>
      <Settings size={48} className="mb-4 opacity-30" />
      <p>{language === 'ru' ? 'Выберите узел для редактирования свойств' : 'Select a node to edit properties'}</p>
    </div>
  );

  const { data, id } = selectedNode;

  useEffect(() => {
    setActiveCellId(null);
  }, [id]);

  useEffect(() => {
    if (activeCellId && !data.tableConfig?.cells?.some((cell) => cell.id === activeCellId)) {
      setActiveCellId(null);
    }
  }, [activeCellId, data.tableConfig?.cells]);

  const features = { ...defaultFeatures, ...(data.features || {}) };

  const addOption = () => {
    const newOpt = { id: `opt-${Date.now()}`, label: language === 'ru' ? 'Новый вариант' : 'New Option' };
    const currentOpts = data.options || [];
    updateNode(id, { options: [...currentOpts, newOpt] });
  };

  const updateOption = (optId: string, updates: { label?: string; hint?: string }) => {
    const currentOpts = data.options || [];
    updateNode(id, { options: currentOpts.map(o => o.id === optId ? { ...o, ...updates } : o) });
  };

  const removeOption = (optId: string) => {
    const currentOpts = data.options || [];
    updateNode(id, { options: currentOpts.filter(o => o.id !== optId) });
  };

  const addPath = () => {
    const newPath: LogicPath = { id: `path-${Date.now()}`, label: language === 'ru' ? 'Новый путь' : 'New Path', requiredOptionIds: [] };
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

  const addContentBlock = (type: AdditionalContentBlock['type']) => {
    const current = data.additionalContent || [];
    const defaults: Record<AdditionalContentBlock['type'], AdditionalContentBlock> = {
      link: { id: `cnt-${Date.now()}`, type: 'link', title: language === 'ru' ? 'Ссылка' : 'Link', url: 'https://example.com' },
      image: { id: `cnt-${Date.now()}`, type: 'image', title: language === 'ru' ? 'Изображение' : 'Image', url: 'https://placehold.co/600x300' },
      table: { id: `cnt-${Date.now()}`, type: 'table', title: language === 'ru' ? 'Таблица' : 'Table', markdown: language === 'ru' ? '| Параметр | Значение |\n|---|---|\n| A | 1 |' : '| Parameter | Value |\n|---|---|\n| A | 1 |' },
    };
    updateNode(id, { additionalContent: [...current, defaults[type]] });
  };

  const updateContentBlock = (blockId: string, updates: Partial<AdditionalContentBlock>) => {
    const current = data.additionalContent || [];
    updateNode(id, { additionalContent: current.map((b) => b.id === blockId ? ({ ...b, ...updates } as AdditionalContentBlock) : b) });
  };

  const removeContentBlock = (blockId: string) => {
    const current = data.additionalContent || [];
    updateNode(id, { additionalContent: current.filter((b) => b.id !== blockId) });
  };

  const initTable = () => {
    const options = data.options || [];
    const cells: TableCell[] = options.map((opt) => ({ id: `cell-${opt.id}`, label: opt.label, optionId: opt.id }));
    updateNode(id, { tableConfig: { columns: 2, cells } });
  };

  const updateCell = (cellId: string, updates: Partial<TableCell>) => {
    const tableConfig = data.tableConfig || { columns: 2, cells: [] };
    updateNode(id, { tableConfig: { ...tableConfig, cells: tableConfig.cells.map(c => c.id === cellId ? { ...c, ...updates } : c) } });
  };

  const addCell = (isLegend = false) => {
    const tableConfig = data.tableConfig || { columns: 2, cells: [] };
    const newCell: TableCell = { id: `cell-${Date.now()}`, label: isLegend ? language === 'ru' ? 'Легенда' : 'Legend' : language === 'ru' ? 'Ячейка варианта' : 'Option Cell', isLegend };
    if (!isLegend && data.options?.[0]) {
      newCell.optionId = data.options[0].id;
      newCell.label = data.options[0].label;
    }
    updateNode(id, { tableConfig: { ...tableConfig, cells: [...tableConfig.cells, newCell] } });
  };

  const removeCell = (cellId: string) => {
    const tableConfig = data.tableConfig || { columns: 2, cells: [] };
    if (activeCellId === cellId) {
      setActiveCellId(null);
    }
    updateNode(id, { tableConfig: { ...tableConfig, cells: tableConfig.cells.filter(c => c.id !== cellId) } });
  };

  const getOptionLabel = (optionId?: string) => {
    if (!optionId) return language === 'ru' ? 'Без варианта' : 'No option';
    const option = data.options?.find((opt) => opt.id === optionId);
    return option?.label || (language === 'ru' ? 'Не найдено' : 'Not found');
  };

  const setFeature = (key: keyof typeof defaultFeatures, value: boolean) => {
    updateNode(id, { features: { ...features, [key]: value } });
  };

  return (
    <div className={`w-full border-l flex flex-col h-full overflow-hidden ${className} ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-100'}`}>
      <div className={`p-4 border-b font-semibold flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'bg-gray-300 text-gray-800'}`}>
        <span>{language === 'ru' ? 'Редактирование узла' : 'Edit Node'}</span>
        <span className={`text-xs px-2 py-1 rounded uppercase ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-white/60 text-gray-700'}`}>{data.type}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{language === 'ru' ? 'Метка (внутренняя)' : 'Label (Internal)'}</label>
          <input className={`w-full p-2 border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={data.label} onChange={(e) => updateNode(id, { label: e.target.value })} />
          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Content / Question</label>
          <textarea className={`w-full p-2 border rounded min-h-[100px] ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={data.content} onChange={(e) => updateNode(id, { content: e.target.value })} />

          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Подсказка заголовка</label>
          <input className={`w-full p-2 border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={data.titleHint || ''} onChange={(e) => updateNode(id, { titleHint: e.target.value })} />
        </div>

        <div className={`space-y-2 border rounded p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-300 bg-white'}`}>
          <div className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Feature toggles</div>
          {Object.entries(features).map(([key, value]) => (
            <label key={key} className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
              <input type="checkbox" checked={value} onChange={(e) => setFeature(key as keyof typeof defaultFeatures, e.target.checked)} />
              {key}
            </label>
          ))}
        </div>

        {(data.type === 'radio' || data.type === 'checkbox') && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{language === 'ru' ? 'Варианты' : 'Options'}</label>
              <button onClick={addOption} className={`text-xs flex items-center gap-1 font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}><Plus size={12} /> {panelText.add}</button>
            </div>
            <div className="space-y-2">
              {data.options?.map(opt => (
                <div key={opt.id} className={`p-2 rounded border space-y-2 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                  <div className="flex gap-2">
                    <input className={`flex-1 p-1.5 text-sm border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={opt.label} onChange={(e) => updateOption(opt.id, { label: e.target.value })} />
                    <button onClick={() => removeOption(opt.id)} className="text-red-500"><Trash2 size={14} /></button>
                  </div>
                  <input placeholder={language === 'ru' ? 'Подсказка варианта' : 'Option hint'} className={`w-full p-1.5 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={opt.hint || ''} onChange={(e) => updateOption(opt.id, { hint: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {(data.type === 'radio' || data.type === 'checkbox') && (
          <div className={`space-y-3 border-t pt-4 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>Table choice layout</label>
              {!data.tableConfig && <button onClick={initTable} className="text-xs text-blue-500">{panelText.initFromOptions}</button>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => addCell(false)} className="text-xs text-blue-500">{panelText.addOptionCell}</button>
              <button onClick={() => addCell(true)} className="text-xs text-purple-500">{panelText.addLegendCell}</button>
            </div>
            <input type="number" min={1} max={6} value={data.tableConfig?.columns || 2} onChange={(e) => updateNode(id, { tableConfig: { columns: Number(e.target.value), cells: data.tableConfig?.cells || [] } })} className={`w-24 p-1 border rounded text-xs ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} />
            <div className="grid gap-2" style={{ gridTemplateColumns: getTableGridTemplateColumns(data.tableConfig?.columns) }}>
              {data.tableConfig?.cells?.map((cell) => {
                const isLegend = !!cell.isLegend;
                const isActive = activeCellId === cell.id;
                return (
                  <div
                    key={cell.id}
                    onClick={() => setActiveCellId(cell.id)}
                    className={`${getTableCellClasses(isDarkMode, isLegend)} cursor-pointer ${isActive ? (isDarkMode ? 'ring-1 ring-blue-400' : 'ring-1 ring-blue-500') : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{cell.label}</p>
                        <p className={isDarkMode ? 'text-[11px] text-slate-400' : 'text-[11px] text-gray-500'}>{isLegend ? panelText.cellLegendType : panelText.cellOptionType}</p>
                        <p className={isDarkMode ? 'text-[11px] text-slate-300 truncate' : 'text-[11px] text-gray-600 truncate'}>{isLegend ? panelText.legendCell : getOptionLabel(cell.optionId)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCell(cell.id);
                        }}
                        className="text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {isActive && (
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          className={`w-full p-1 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`}
                          value={cell.label}
                          onChange={(e) => updateCell(cell.id, { label: e.target.value })}
                          placeholder={language === 'ru' ? 'Название ячейки' : 'Cell label'}
                        />
                        <input
                          placeholder={language === 'ru' ? 'Подсказка ячейки' : 'Cell hint'}
                          className={`w-full p-1 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`}
                          value={cell.hint || ''}
                          onChange={(e) => updateCell(cell.id, { hint: e.target.value })}
                        />
                        <label className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!cell.isLegend}
                            onChange={(e) => updateCell(cell.id, { isLegend: e.target.checked, optionId: e.target.checked ? undefined : cell.optionId })}
                          />
                          legend
                        </label>
                        {!cell.isLegend && (
                          <select
                            value={cell.optionId || ''}
                            onChange={(e) => updateCell(cell.id, { optionId: e.target.value || undefined })}
                            className={`w-full p-1 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`}
                          >
                            <option value="">{language === 'ru' ? 'Без варианта' : 'No option'}</option>
                            {data.options?.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`space-y-3 border-t pt-4 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex gap-2 text-xs">
            <button onClick={() => addContentBlock('link')} className="text-blue-500">+ {language === 'ru' ? 'Ссылка' : 'Link'}</button>
            <button onClick={() => addContentBlock('image')} className="text-blue-500">+ {language === 'ru' ? 'Изображение' : 'Image'}</button>
            <button onClick={() => addContentBlock('table')} className="text-blue-500">+ {language === 'ru' ? 'Таблица' : 'Table'}</button>
          </div>
          {data.additionalContent?.map((block) => (
            <div key={block.id} className={`p-2 border rounded space-y-2 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
              <div className="flex justify-between">
                <span className="text-xs font-bold">{block.type}</span>
                <button onClick={() => removeContentBlock(block.id)} className="text-red-500"><Trash2 size={12} /></button>
              </div>
              <input className={`w-full p-1 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={block.title} onChange={(e) => updateContentBlock(block.id, { title: e.target.value } as Partial<AdditionalContentBlock>)} />
              {block.type === 'table' ? (
                <textarea className={`w-full p-1 text-xs border rounded min-h-[80px] ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={block.markdown} onChange={(e) => updateContentBlock(block.id, { markdown: e.target.value } as Partial<AdditionalContentBlock>)} />
              ) : (
                <input className={`w-full p-1 text-xs border rounded ${isDarkMode ? 'text-slate-100 bg-slate-800 border-slate-600' : 'text-gray-900 bg-white border-gray-300'}`} value={block.url} onChange={(e) => updateContentBlock(block.id, { url: e.target.value } as Partial<AdditionalContentBlock>)} />
              )}
            </div>
          ))}
        </div>

        {data.type === 'checkbox' && (
          <div className={`space-y-3 border-t pt-4 ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
             <div className="flex justify-between items-center">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{language === 'ru' ? 'Выходные пути' : 'Output Paths'}</label>
              <button onClick={addPath} className={`text-xs flex items-center gap-1 font-semibold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}><Plus size={12} /> {language === 'ru' ? 'Добавить путь' : 'Add Path'}</button>
            </div>
            <div className="space-y-4">
              {data.paths?.map(path => (
                <div key={path.id} className={`p-3 rounded border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between mb-2">
                     <input className={`flex-1 p-1 text-xs border rounded font-medium ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-gray-50 border-gray-300 text-gray-900'}`} value={path.label} onChange={(e) => updatePath(path.id, { label: e.target.value })} placeholder={language === 'ru' ? 'Название пути' : 'Path Name'} />
                     <button onClick={() => removePath(path.id)} className="ml-2 text-red-500"><Trash2 size={12} /></button>
                  </div>
                  {data.options?.map(opt => (
                    <label key={opt.id} className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                      <input type="checkbox" checked={path.requiredOptionIds.includes(opt.id)} onChange={(e) => {
                        const newReqs = e.target.checked ? [...path.requiredOptionIds, opt.id] : path.requiredOptionIds.filter(rid => rid !== opt.id);
                        updatePath(path.id, { requiredOptionIds: newReqs });
                      }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.type === 'end' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="canRestart" checked={data.canRestart || false} onChange={(e) => updateNode(id, { canRestart: e.target.checked })} />
            <label htmlFor="canRestart" className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{language === 'ru' ? 'Разрешить перезапуск' : 'Allow Restart'}</label>
          </div>
        )}
      </div>
    </div>
  );
};

export { PropertiesPanel };
