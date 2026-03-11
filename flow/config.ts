import { CheckSquare, Circle, FileText, Flag } from 'lucide-react';
import { AppNode, CatalogFolderConfig } from './types';

export const CATALOG_FOLDERS: CatalogFolderConfig[] = [
  {
    id: 'demo-1',
    name: 'Example Flowcharts',
    owner: 'langchain-ai', // Example: public repo
    repo: 'langgraph-example', // Example: public repo
    path: 'examples' // Example folder
  },
  {
    id: 'default',
    name: 'default',
    owner: 'MB2923',
    repo: 'flowbuilder-charts',
    path: ''
  }
];


export const INITIAL_NODES: AppNode[] = [
  {
    id: 'start',
    type: 'static',
    position: { x: 0, y: 150 },
    data: { label: 'Start', content: 'Welcome! Let us begin the process.', type: 'static' },
  },
];

export const NODE_TYPES_CONFIG = {
  static: { 
    label: 'Info Card', 
    icon: FileText, 
    color: 'bg-gray-50 border-gray-200',
    description: 'Display text or information. No choices.'
  },
  radio: { 
    label: 'Single Choice', 
    icon: Circle, 
    color: 'bg-gray-50 border-gray-200',
    description: 'User must pick exactly one option.'
  },
  checkbox: { 
    label: 'Multiple Choice', 
    icon: CheckSquare, 
    color: 'bg-gray-50 border-gray-200',
    description: 'User can pick multiple options. Complex logic support.'
  },
  end: { 
    label: 'End Point', 
    icon: Flag, 
    color: 'bg-gray-50 border-gray-200',
    description: 'Finishes the flow. Optional restart.'
  },
};
