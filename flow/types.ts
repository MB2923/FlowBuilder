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
  hint?: string;
}

export interface LogicPath {
  id: string; // Creates a Handle ID
  label: string;
  requiredOptionIds: string[]; // Logic: AND condition for these options
}

export type AdditionalContentBlock =
  | { id: string; type: 'link'; title: string; url: string }
  | { id: string; type: 'image'; title: string; url: string }
  | { id: string; type: 'table'; title: string; markdown: string };

export interface TableCell {
  id: string;
  label: string;
  optionId?: string;
  isLegend?: boolean;
  hint?: string;
}

export interface NodeFeatureToggles {
  enableTitleHint: boolean;
  enableOptionHints: boolean;
  enableAdditionalContent: boolean;
  enableTableLayout: boolean;
  enableCopyButton: boolean;
}

export interface ChoiceTableConfig {
  columns: number;
  cells: TableCell[];
}

export interface NodeData {
  label: string; // Internal name
  content: string; // Display text/question
  type: NodeType;
  titleHint?: string;
  options?: Option[]; // For radio/checkbox
  paths?: LogicPath[]; // For checkbox logic specifically
  canRestart?: boolean; // For end node
  additionalContent?: AdditionalContentBlock[];
  tableConfig?: ChoiceTableConfig;
  features?: Partial<NodeFeatureToggles>;
  [key: string]: unknown;
}

export type AppNode = Node<NodeData>;

export const ThemeModeContext = createContext(false);
export const LanguageContext = createContext<'en' | 'ru'>('en');

export interface FlowData {
  nodes: AppNode[];
  edges: Edge[];
}

export interface AppErrorLike {
  name?: string;
  message?: string;
}
