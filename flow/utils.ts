import dagre from 'dagre';
import { Edge } from '@xyflow/react';
import { AppNode, FlowData } from './types';

export const getLayoutedElements = (nodes: AppNode[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = true;
  dagreGraph.setGraph({ rankdir: isHorizontal ? 'LR' : 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 150 }); // Estimate size
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const isFlowData = (value: unknown): value is FlowData => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FlowData>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
};

