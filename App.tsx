import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  MarkerType,
  useReactFlow,
  useOnSelectionChange,
} from '@xyflow/react';
import { ArrowLeft, Book, ChevronRight, FileJson, Folder, Layout, Link as LinkIcon, Loader2, Moon, Play, Redo2, Save, Settings, Share2, Sun, Undo2, Upload, X } from 'lucide-react';
import { DraggableToolboxItem } from './components/DraggableToolboxItem';
import { nodeTypes } from './components/NodeTypes';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CATALOG_FOLDERS, INITIAL_NODES, NODE_TYPES_CONFIG } from './flow/config';
import { AppErrorLike, AppNode, CatalogFolderConfig, FlowMode, LanguageContext, NodeData, NodeType, ThemeModeContext } from './flow/types';
import { Language, NODE_TYPE_TEXT } from './flow/i18n';
import { getLayoutedElements, isFlowData } from './flow/utils';

const Viewer = lazy(() => import('./components/Viewer').then((module) => ({ default: module.Viewer })));

// --- Error Suppression ---
// ResizeObserver loop errors are benign layout thrashing warnings common in complex flex/grid + canvas apps.
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications';
const resizeObserverLoopLimitErr = 'ResizeObserver loop limit exceeded';

window.addEventListener('error', (e) => {
  if (
    e.message.includes(resizeObserverLoopErr) ||
    e.message.includes(resizeObserverLoopLimitErr)
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Patch console.error to catch frameworks/overlays that might intercept this
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes(resizeObserverLoopErr) || args[0].includes(resizeObserverLoopLimitErr))
  ) {
    return;
  }
  originalConsoleError(...args);
};

interface GitHubFile {
  name: string;
  download_url: string;
  type: 'file' | 'dir';
}


const DRAFT_STORAGE_KEY = 'flowbuilder-draft-v1';
const LANG_STORAGE_KEY = 'flowbuilder-language';
const MAX_HISTORY_SIZE = 100;
const FLOW_URL_PARAM = 'flowUrl';
const FLOW_DATA_PARAM = 'flowData';

const encodeFlowData = (flow: { nodes: AppNode[]; edges: Edge[] }) => {
  const json = JSON.stringify(flow);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeFlowData = (encoded: string) => {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
};

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mode, setMode] = useState<FlowMode>('editor');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [showSettings, setShowSettings] = useState(false);
  const edgeColor = isDarkMode ? '#94a3b8' : '#475569';
  const defaultEdgeOptions = useMemo(() => ({
    animated: false,
    style: { stroke: edgeColor, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
  }), [edgeColor]);

  // Modal State
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // Catalog State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<CatalogFolderConfig | null>(null);
  const [repoFiles, setRepoFiles] = useState<GitHubFile[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isInitializingFlow, setIsInitializingFlow] = useState(true);
  const [history, setHistory] = useState(() => [{ nodes: INITIAL_NODES, edges: [] as Edge[] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const urlImportAttemptedRef = useRef(false);

  const { deleteElements, screenToFlowPosition } = useReactFlow<AppNode>();

  // Selection state for global delete
  const [selectedElements, setSelectedElements] = useState<{ nodes: AppNode[], edges: Edge[] }>({ nodes: [], edges: [] });

  useOnSelectionChange({
    onChange: ({ nodes, edges }) => {
      setSelectedElements({ nodes: nodes as AppNode[], edges });
      // Logic for Properties Panel selection
      if (nodes.length === 1) {
        setSelectedNodeId(nodes[0].id);
      } else if (nodes.length === 0) {
        setSelectedNodeId(null);
      }
    },
  });

  // Global Delete Handler
  useEffect(() => {
    const storedTheme = localStorage.getItem('flowbuilder-theme');
    const storedLanguage = localStorage.getItem(LANG_STORAGE_KEY);
    if (storedLanguage === 'ru' || storedLanguage === 'en') {
      setLanguage(storedLanguage);
    }
    if (storedTheme) {
      setIsDarkMode(storedTheme === 'dark');
      return;
    }

    setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    localStorage.setItem('flowbuilder-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, language);
  }, [language]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const commitSnapshot = useCallback((nextNodes: AppNode[], nextEdges: Edge[]) => {
    setHistory((prevHistory) => {
      const nextSnapshot = JSON.stringify({ nodes: nextNodes, edges: nextEdges });
      const currentSnapshot = JSON.stringify(prevHistory[historyIndex]);
      if (nextSnapshot === currentSnapshot) {
        return prevHistory;
      }

      const trimmed = prevHistory.slice(0, historyIndex + 1);
      const updated = [...trimmed, { nodes: nextNodes, edges: nextEdges }];
      if (updated.length > MAX_HISTORY_SIZE) {
        updated.shift();
      }
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [historyIndex]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params as Edge, eds)),
    [setEdges],
  );


  const handleNodeClick = useCallback((_: React.MouseEvent, node: AppNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AppNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: {
          label: `${language === 'ru' ? 'Новый' : 'New'} ${NODE_TYPE_TEXT[language][type].label}`,
          content: 'Click to edit content...',
          type,
          options: [],
          paths: [],
          additionalContent: [],
          tableConfig: { columns: 2, cells: [] },
          features: {
            enableTitleHint: true,
            enableOptionHints: true,
            enableAdditionalContent: true,
            enableTableLayout: false,
            enableCopyButton: true,
          },
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [language, setNodes, screenToFlowPosition],
  );

  const updateNode = (id: string, newData: Partial<NodeData>) => {
    setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  };

  const handleLayout = () => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
  };

  const handleSave = () => {
    const data = JSON.stringify({ nodes, edges });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flowchart.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadFlowData = (data: unknown) => {
    if (isFlowData(data)) {
      setNodes(data.nodes);
      setEdges(data.edges);
      setHistory([{ nodes: data.nodes, edges: data.edges }]);
      setHistoryIndex(0);
      return true;
    }
    return false;
  };

  const handleUndo = useCallback(() => {
    if (historyIndex === 0) return;
    const previousSnapshot = history[historyIndex - 1];
    setNodes(previousSnapshot.nodes);
    setEdges(previousSnapshot.edges);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex, setEdges, setNodes]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextSnapshot = history[historyIndex + 1];
    setNodes(nextSnapshot.nodes);
    setEdges(nextSnapshot.edges);
    setHistoryIndex(historyIndex + 1);
  }, [history, historyIndex, setEdges, setNodes]);

  useEffect(() => {
    const loadFlowFromSearchParams = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const encodedFlow = searchParams.get(FLOW_DATA_PARAM);
      const externalFlowUrl = searchParams.get(FLOW_URL_PARAM);

      if (encodedFlow) {
        try {
          const parsed = decodeFlowData(encodedFlow);
          if (loadFlowData(parsed)) {
            urlImportAttemptedRef.current = true;
            return;
          }
        } catch (error) {
          console.error(error);
          alert('Invalid embedded flowData link.');
        }
      }

      if (externalFlowUrl) {
        const success = await executeUrlImport(externalFlowUrl);
        if (success) {
          urlImportAttemptedRef.current = true;
        }
      }
    };

    loadFlowFromSearchParams().finally(() => {
      setIsInitializingFlow(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializingFlow) return;
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft && !urlImportAttemptedRef.current) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        if (isFlowData(parsedDraft)) {
          setNodes(parsedDraft.nodes);
          setEdges(parsedDraft.edges);
          setHistory([{ nodes: parsedDraft.nodes, edges: parsedDraft.edges }]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error(error);
      }
    }
    setIsDraftLoaded(true);
  }, [isInitializingFlow, setEdges, setNodes]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ nodes, edges }));
    }, 500);

    return () => clearTimeout(timeout);
  }, [edges, isDraftLoaded, nodes]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    commitSnapshot(nodes, edges);
  }, [commitSnapshot, edges, isDraftLoaded, nodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Allow default behavior for inputs
      if (
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (['Delete', 'Backspace'].includes(event.key)) {
        if (selectedElements.nodes.length > 0 || selectedElements.edges.length > 0) {
          deleteElements({ nodes: selectedElements.nodes, edges: selectedElements.edges });
        }
        return;
      }

      const isModKey = event.metaKey || event.ctrlKey;
      if (!isModKey) {
        return;
      }

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteElements, handleRedo, handleUndo, selectedElements]);


  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = JSON.parse(event.target?.result as string);
        if (!loadFlowData(result)) {
           alert('Invalid JSON file');
        }
      } catch {
        alert('Invalid JSON file');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromUrl = () => {
    setShowUrlModal(true);
  };

  const executeUrlImport = async (url: string) => {
    if (!url) return;
    let urlToFetch = url.trim();

    // Fix common user error: Using GitHub blob link instead of raw
    if (urlToFetch.includes('github.com') && urlToFetch.includes('/blob/')) {
      urlToFetch = urlToFetch.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    try {
      const res = await fetch(urlToFetch);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      
      if (loadFlowData(data)) {
        const parsedUrl = new URL(window.location.href);
        parsedUrl.searchParams.set(FLOW_URL_PARAM, urlToFetch);
        parsedUrl.searchParams.delete(FLOW_DATA_PARAM);
        window.history.replaceState({}, '', parsedUrl.toString());
        return true;
      } else {
        alert('Invalid flowchart JSON structure.');
        return false;
      }
    } catch (error: unknown) {
      const appError = error as AppErrorLike;
      console.error(error);
      const errorMessage = appError.message ?? 'Unknown error';
      const isCors =
        appError.name === 'TypeError' &&
        (errorMessage === 'Failed to fetch' || errorMessage.includes('NetworkError'));
      let msg = `Import Failed: ${errorMessage}`;
      if (isCors) msg = `Network Error (CORS). ensure "raw" link used.`;
      alert(msg);
      return false;
    }
  };

  const handleCopyShareLink = async () => {
    try {
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.delete(FLOW_URL_PARAM);
      shareUrl.searchParams.set(FLOW_DATA_PARAM, encodeFlowData({ nodes, edges }));
      await navigator.clipboard.writeText(shareUrl.toString());
      alert('Share link copied to clipboard.');
    } catch (error) {
      console.error(error);
      alert('Unable to copy share link.');
    }
  };
  
  // Catalog Handlers
  const fetchFolderContents = async (folder: CatalogFolderConfig) => {
    setActiveFolder(folder);
    setLoadingCatalog(true);
    setRepoFiles([]);
    
    try {
      const url = `https://api.github.com/repos/${folder.owner}/${folder.repo}/contents/${folder.path}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
           // Filter for json files
           const files = data.filter(
             (item: GitHubFile) => item.type === 'file' && item.name.endsWith('.json'),
           );
           setRepoFiles(files);
        } else {
           setRepoFiles([]);
           alert('Unexpected response from GitHub.');
        }
      } else {
        alert('Failed to load folder. Check configuration or rate limits.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error fetching catalog.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadCatalogFile = async (file: GitHubFile) => {
    setLoadingCatalog(true);
    const success = await executeUrlImport(file.download_url);
    setLoadingCatalog(false);
    if (success) {
      setIsCatalogOpen(false); // Close sidebar on success
    }
  };

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden relative transition-colors ${isDarkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>
      
      {/* Top Bar */}
      <header className={`h-16 border-b flex items-center justify-between px-6 shadow-sm z-20 relative shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">F</div>
            <h1 className={`font-bold hidden sm:block ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>FlowBuilder</h1>
          </div>
          
          <button 
             onClick={() => setIsCatalogOpen(!isCatalogOpen)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
               isCatalogOpen
                 ? 'bg-blue-100 text-blue-700'
                 : isDarkMode
                   ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
             }`}
          >
             <Book size={16} /> {language === 'ru' ? 'Каталог' : 'Catalog'}
          </button>
        </div>

        {/* Toolbox Area */}
        <div className="flex items-center justify-center gap-4 mx-4 flex-1">
          <div className={`rounded-lg p-1 flex items-center gap-2 border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
             <DraggableToolboxItem type="static" language={language} />
             <DraggableToolboxItem type="radio" language={language} />
             <DraggableToolboxItem type="checkbox" language={language} />
             <DraggableToolboxItem type="end" language={language} />
          </div>
          <span className={`text-xs font-medium hidden lg:inline ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>{language === 'ru' ? 'Перетащите элементы на холст' : 'Drag items to canvas'}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              title={language === 'ru' ? 'Настройки' : 'Settings'}
              className={`p-2 rounded text-sm flex gap-1 font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Settings size={18} />
            </button>
            {showSettings && (
              <div className={`absolute right-0 mt-2 w-56 rounded-lg border shadow-lg p-3 z-50 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-800'}`}>
                <div className="text-xs mb-2 font-semibold">{language === 'ru' ? 'Тема' : 'Theme'}</div>
                <button onClick={() => setIsDarkMode((prev) => !prev)} className={`w-full mb-3 px-3 py-2 rounded flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  {isDarkMode ? (language === 'ru' ? 'Светлая тема' : 'Light mode') : (language === 'ru' ? 'Тёмная тема' : 'Dark mode')}
                </button>
                <div className="text-xs mb-2 font-semibold">{language === 'ru' ? 'Язык' : 'Language'}</div>
                <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={`w-full px-2 py-2 text-sm rounded border ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            )}
          </div>
          <button onClick={handleLayout} title={language === 'ru' ? 'Авто-компоновка' : 'Auto Layout'} className={`p-2 rounded text-sm flex gap-1 font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
             <Layout size={18} />
          </button>
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            title={language === 'ru' ? 'Отменить' : 'Undo'}
            className={`p-2 rounded text-sm flex gap-1 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title={language === 'ru' ? 'Повторить' : 'Redo'}
            className={`p-2 rounded text-sm flex gap-1 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Redo2 size={18} />
          </button>
          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
          <label title={language === 'ru' ? 'Импорт из файла' : 'Import from File'} className={`p-2 rounded cursor-pointer text-sm flex gap-1 items-center font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Upload size={18} />
            <input type="file" accept=".json" onChange={handleLoad} className="hidden" />
          </label>
          <button onClick={handleImportFromUrl} title={language === 'ru' ? 'Импорт по ссылке' : 'Import from URL'} className={`p-2 rounded text-sm flex gap-1 items-center font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <LinkIcon size={18} />
          </button>
          <button onClick={handleCopyShareLink} title={language === 'ru' ? 'Скопировать ссылку' : 'Copy share link'} className={`p-2 rounded text-sm flex gap-1 items-center font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Share2 size={18} />
          </button>
          <button onClick={handleSave} title={language === 'ru' ? 'Сохранить' : 'Save'} className={`p-2 rounded text-sm flex gap-1 items-center font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Save size={18} />
          </button>
          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
          <button 
            onClick={() => setMode('viewer')} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <Play size={16} /> <span className="hidden sm:inline">{language === 'ru' ? 'Запустить' : 'Run Flow'}</span>
          </button>
        </div>
      </header>

      {/* Catalog Sidebar */}
      <div 
        className={`absolute top-16 left-0 bottom-0 shadow-xl border-r z-30 transition-all duration-300 ease-in-out flex flex-col ${isCatalogOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}
      >
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
           <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
             {activeFolder ? (
               <button onClick={() => setActiveFolder(null)} className={`p-1 rounded ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={16}/></button>
             ) : <Book size={18}/>} 
             {activeFolder ? activeFolder.name : language === 'ru' ? 'Папки каталога' : 'Catalog Folders'}
           </h3>
           <button onClick={() => setIsCatalogOpen(false)}><X size={18} className={isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loadingCatalog ? (
            <div className={`flex flex-col items-center justify-center h-40 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
               <Loader2 className="animate-spin mb-2" />
               <span className="text-xs">{language === 'ru' ? 'Загрузка содержимого...' : 'Loading contents...'}</span>
            </div>
          ) : (
             <>
               {/* Folder List View */}
               {!activeFolder && (
                 <div className="space-y-2">
                   {CATALOG_FOLDERS.map(folder => (
                     <div 
                        key={folder.id} 
                        onClick={() => fetchFolderContents(folder)}
                        className={`p-3 rounded border cursor-pointer transition-colors flex items-center gap-3 group ${isDarkMode ? 'border-slate-700 hover:border-blue-400 hover:bg-slate-800' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}
                      >
                        <div className="p-2 bg-blue-100 text-blue-600 rounded group-hover:bg-blue-200">
                           <Folder size={20} />
                        </div>
                        <div>
                          <div className={`font-semibold text-sm ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{folder.name}</div>
                          <div className={`text-xs truncate max-w-[160px] ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{folder.owner}/{folder.repo}</div>
                        </div>
                        <ChevronRight size={16} className={`ml-auto group-hover:text-blue-500 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}/>
                     </div>
                   ))}
                 </div>
               )}

               {/* File List View */}
               {activeFolder && (
                 <div className="space-y-2">
                    {repoFiles.length === 0 ? (
                      <div className={`text-center text-sm py-8 italic ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>{language === 'ru' ? 'В этой папке не найдено .json файлов.' : 'No .json files found in this folder.'}</div>
                    ) : (
                      repoFiles.map(file => (
                        <div 
                          key={file.name}
                          onClick={() => loadCatalogFile(file)}
                          className={`p-3 rounded border hover:border-green-400 cursor-pointer transition-colors flex items-center gap-3 group ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-gray-200 hover:bg-green-50'}`}
                        >
                          <div className="p-2 bg-green-100 text-green-600 rounded group-hover:bg-green-200">
                             <FileJson size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className={`font-semibold text-sm truncate ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{file.name}</div>
                          </div>
                        </div>
                      ))
                    )}
                 </div>
               )}
             </>
          )}
        </div>
        <div className={`p-3 border-t text-[10px] text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
           {language === 'ru' ? 'Измените CATALOG_FOLDERS в index.tsx, чтобы добавить свои репозитории.' : 'Edit CATALOG_FOLDERS in index.tsx to add your own repos.'}
        </div>
      </div>

      {/* Editor Body */}
      <ThemeModeContext.Provider value={isDarkMode}>
      <LanguageContext.Provider value={language}>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div className={`flex-1 h-full relative transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <ReactFlow<AppNode>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onPaneClick={() => setSelectedNodeId(null)}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            colorMode={isDarkMode ? 'dark' : 'light'}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            snapToGrid
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background color={isDarkMode ? '#334155' : '#cbd5e1'} gap={20} />
            <Controls />
            <MiniMap className={isDarkMode ? 'bg-slate-800 border border-slate-600 rounded shadow-lg' : 'bg-white border rounded shadow-lg'} zoomable pannable />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <PropertiesPanel selectedNode={selectedNode} updateNode={updateNode} language={language} />
        )}
      </div>
      </LanguageContext.Provider>
      </ThemeModeContext.Provider>

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{language === 'ru' ? 'Импорт по ссылке' : 'Import from URL'}</h3>
              <button onClick={() => setShowUrlModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-3">
                {language === 'ru' ? 'Введите прямую ссылку на raw JSON файл со схемой.' : 'Enter a direct link to a raw JSON file containing the flowchart data.'}
              </p>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm mb-4"
                placeholder="https://example.com/flowchart.json"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    executeUrlImport(importUrl).then(success => {
                       if(success) { setShowUrlModal(false); setImportUrl(''); }
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                >
                  {language === 'ru' ? 'Импорт' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Overlay */}
      {mode === 'viewer' && (
        <Suspense fallback={
          <div className={`h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        }>
          <Viewer nodes={nodes} edges={edges} onExit={() => setMode('editor')} isDarkMode={isDarkMode} language={language} />
        </Suspense>
      )}
    </div>
  );
};

export default App;
