export const getTableGridTemplateColumns = (columns?: number) => `repeat(${Math.max(1, columns || 2)}, minmax(0,1fr))`;

export const getTableCellClasses = (isDarkMode: boolean, isLegend: boolean) => {
  const legendClass = isLegend ? 'opacity-70 italic' : '';
  const modeClass = isDarkMode
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-gray-200 text-gray-800';

  return `relative p-2 rounded text-xs border ${legendClass} ${modeClass}`;
};
