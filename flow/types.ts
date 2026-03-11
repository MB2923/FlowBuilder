import { createContext } from 'react';
import { Edge, Node } from '@xyflow/react';

export interface CatalogFolderConfig {
  id: string;
  name: string;
  owner: string;
  repo: string;
  path: string;
}


export type FlowMode = 'editor' | 'viewer';

export type NodeType = 'radio' | 'checkbox' | 'static' | 'end';

export interface Option {
  id: string;
  label: string;
}

export interface LogicPath {
  id: string; // Creates a Handle ID
  label: string;
  requiredOptionIds: string[]; // Logic: AND condition for these options
}

export interface NodeData {
  label: string; // Internal name
  content: string; // Display text/question
  type: NodeType;
  options?: Option[]; // For radio/checkbox
  paths?: LogicPath[]; // For checkbox logic specifically
  canRestart?: boolean; // For end node
  [key: string]: unknown; // Fix: Index signature for Record<string, unknown> compatibility
}

export type AppNode = Node<NodeData>;

export const ThemeModeContext = createContext(false);

export interface FlowData {
  nodes: AppNode[];
  edges: Edge[];
}

export interface AppErrorLike {
  name?: string;
  message?: string;
}

