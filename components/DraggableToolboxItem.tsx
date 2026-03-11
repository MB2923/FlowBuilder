import React from 'react';
import { NODE_TYPES_CONFIG } from '../flow/config';
import { NodeType } from '../flow/types';

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


export { DraggableToolboxItem };
