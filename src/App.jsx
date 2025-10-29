import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import './index.css';

const SAMPLE_JSON = `{
  "user": {
    "id": 1,
    "name": "John Doe",
    "address": { "city": "New York", "country": "USA" },
    "items": [ { "name": "item1" }, { "name": "item2" } ]
  }
}`;

const NODE_STYLES = {
  object: { background: '#6a5acd', color: '#fff' },
  array: { background: '#2e8b57', color: '#fff' },
  primitive: { background: '#ff8c00', color: '#000' },
  highlight: { background: '#ff2e63', color: '#fff' },
};

function isPrimitive(v) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

function parsePath(path) {
  if (!path) return [];
  let p = path.trim();
  if (p.startsWith('$')) p = p.slice(1);
  if (p.startsWith('.')) p = p.slice(1);
  if (p === '') return [];
  const tokens = [];
  let buff = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '.') { if (buff) { tokens.push(buff); buff = ''; } }
    else if (ch === '[') {
      if (buff) { tokens.push(buff); buff = ''; }
      let j = i + 1;
      let num = '';
      while (j < p.length && p[j] !== ']') { num += p[j]; j++; }
      i = j;
      tokens.push(Number(num));
    } else buff += ch;
  }
  if (buff) tokens.push(buff);
  return tokens;
}

function buildTree(json) {
  const nodes = [], edges = [];
  const xGap = 240, yGap = 80;
  let yCounter = 0;

  function dfs(value, key, parentId, depth, pathTokens) {
    const pathId = pathTokens.length === 0 ? '$' : ['$'].concat(pathTokens).map(tok => (typeof tok === 'number' ? `[${tok}]` : tok)).join('.');
    const id = pathId;
    let label = key === null ? 'root' : String(key);
    if (isPrimitive(value)) label = `${label}: ${String(value)}`;
    const x = depth * xGap;
    const y = yCounter * yGap;

    const type = isPrimitive(value) ? 'primitive' : Array.isArray(value) ? 'array' : 'object';
    const style = { ...NODE_STYLES[type], padding: 8, borderRadius: 10, width: 160, textAlign: 'center' };

    nodes.push({ id, data: { label, path: pathId, value }, position: { x, y }, style });

    if (parentId) edges.push({ id: `${parentId}-->${id}`, source: parentId, target: id, animated: false });

    if (!isPrimitive(value)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          yCounter++;
          dfs(value[i], `[${i}]`, id, depth + 1, [...pathTokens, i]);
        }
      } else {
        const keys = Object.keys(value);
        for (let k = 0; k < keys.length; k++) {
          yCounter++;
          dfs(value[keys[k]], keys[k], id, depth + 1, [...pathTokens, keys[k]]);
        }
      }
    } else {
      yCounter++;
    }
  }

  yCounter = 0;
  dfs(json, null, null, 0, []);
  return { nodes, edges };
}

export default function App() {
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [jsonError, setJsonError] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [searchPath, setSearchPath] = useState('');
  const [matchMessage, setMatchMessage] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const reactFlowWrapper = useRef(null);

  useEffect(() => {
    try { JSON.parse(jsonText); setJsonError(''); } catch (e) { setJsonError(e.message); }
  }, [jsonText]);

  useEffect(() => {
    // apply dark class to html element
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const onGenerate = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      const { nodes: builtNodes, edges: builtEdges } = buildTree(parsed);
      setNodes(builtNodes);
      setEdges(builtEdges);
      setMatchMessage('');
      setHighlightedNodeId(null);
      setTimeout(() => rfInstance && rfInstance.fitView(), 100);
    } catch (err) {
      setJsonError(err.message);
      setNodes([]);
      setEdges([]);
    }
  }, [jsonText, rfInstance]);

  const onInit = useCallback((instance) => setRfInstance(instance), []);

  const onSearch = useCallback(() => {
    if (!nodes.length) { setMatchMessage('No data. Generate tree first.'); return; }
    const tokens = parsePath(searchPath);
    const pathId = tokens.length === 0 ? '$' : ['$'].concat(tokens).map(tok => (typeof tok === 'number' ? `[${tok}]` : tok)).join('.');
    const found = nodes.find(n => n.id === pathId);
    if (!found) { setMatchMessage('No match found'); setHighlightedNodeId(null); return; }
    setMatchMessage('Match found');
    setHighlightedNodeId(found.id);
    if (rfInstance) {
      const { x, y } = found.position;
      rfInstance.setCenter(x + 80, y + 20, { duration: 400 });
    }
  }, [searchPath, nodes, rfInstance]);

  useEffect(() => {
    if (!nodes.length) return;
    setNodes(nds => nds.map(n => {
      const baseType = isPrimitive(n.data.value) ? 'primitive' : Array.isArray(n.data.value) ? 'array' : 'object';
      const baseStyle = NODE_STYLES[baseType];
      const style = highlightedNodeId && n.id === highlightedNodeId ? { ...n.style, ...NODE_STYLES.highlight } : { ...n.style, ...baseStyle };
      return { ...n, style };
    }));
  }, [highlightedNodeId]);

  return (
    <div className={`min-h-screen p-8 bg-gray-50 dark:bg-gray-900 transition-colors`}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">JSON Tree Visualizer</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                <input
                  value={searchPath}
                  onChange={(e) => setSearchPath(e.target.value)}
                  placeholder="$.user.address.city"
                  className="bg-transparent outline-none text-sm w-64 text-gray-700 dark:text-gray-200"
                />
                <button onClick={onSearch} className="ml-3 px-3 py-1 bg-blue-600 text-white rounded">Search</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Dark/Light</span>
                <button onClick={() => setDarkMode(d => !d)} className="w-12 h-6 bg-gray-200 dark:bg-gray-600 rounded-full relative">
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <label className="text-sm text-gray-600 dark:text-gray-300">Paste or type JSON data</label>
              <textarea
                className="w-full h-64 mt-2 p-3 text-sm font-mono bg-gray-50 dark:bg-gray-800 border rounded-md text-gray-800 dark:text-gray-100"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={SAMPLE_JSON}
              />
              <div className="flex items-center gap-3 mt-3">
                <button onClick={onGenerate} className="px-4 py-2 bg-blue-600 text-white rounded">Generate Tree</button>
                <button onClick={() => { setJsonText(SAMPLE_JSON); setJsonError('') }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded">Load Sample</button>
                <button onClick={() => { setJsonText(''); setNodes([]); setEdges([]); setJsonError('') }} className="px-3 py-2 bg-red-100 dark:bg-red-800 rounded">Clear</button>
              </div>
              {jsonError && <div className="mt-2 text-red-600">{jsonError}</div>}
            </div>

            <div className="col-span-2 h-[520px]">
              <div ref={reactFlowWrapper} className="w-full h-full bg-white dark:bg-gray-900 rounded-md border p-4">
                <ReactFlow nodes={nodes} edges={edges} onInit={onInit} fitView panOnDrag zoomOnScroll attributionPosition="bottom-left">
                  <MiniMap nodeStrokeColor={(n) => {
                    const val = n.data && n.data.value;
                    const type = isPrimitive(val) ? 'primitive' : Array.isArray(val) ? 'array' : 'object';
                    return NODE_STYLES[type].background;
                  }} nodeColor={(n) => {
                    const val = n.data && n.data.value;
                    const type = isPrimitive(val) ? 'primitive' : Array.isArray(val) ? 'array' : 'object';
                    return NODE_STYLES[type].background;
                  }} />
                  <Controls />
                  <Background gap={16} />
                </ReactFlow>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300">{matchMessage}</div>
                <div className="flex gap-2">
                  <button onClick={() => rfInstance && rfInstance.zoomIn()} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded">Zoom In</button>
                  <button onClick={() => rfInstance && rf_instance.zoomOut()} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded">Zoom Out</button>
                  <button onClick={() => rfInstance && rfInstance.fitView()} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded">Fit View</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
