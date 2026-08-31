import type { Node, Edge } from '@xyflow/svelte';

export type LayoutAlgorithm = 'hierarchical' | 'force' | 'grid';
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

export interface LayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  spacingX?: number;
  spacingY?: number;
  iterations?: number;
}

const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 140;
const DEFAULT_SPACING_X = 60;
const DEFAULT_SPACING_Y = 90;

/**
 * Main auto-layout service entry point.
 * Repositions nodes according to the selected algorithm without modifying edge connections.
 */
export function autoLayoutNodes<T extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node<T>[]; edges: Edge[] } {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges };
  }

  if (nodes.length === 1) {
    return {
      nodes: [
        {
          ...nodes[0],
          position: { x: 300, y: 200 },
        },
      ],
      edges,
    };
  }

  const algorithm = options.algorithm || 'hierarchical';

  let layoutedNodes: Node<T>[];
  switch (algorithm) {
    case 'force':
      layoutedNodes = forceDirectedLayout(nodes, edges, options);
      break;
    case 'grid':
      layoutedNodes = gridLayout(nodes, options);
      break;
    case 'hierarchical':
    default:
      layoutedNodes = hierarchicalDagLayout(nodes, edges, options);
      break;
  }

  return {
    nodes: layoutedNodes,
    edges,
  };
}

// ---------------------------------------------------------------------------
// 1. HIERARCHICAL DAG (SUGIYAMA-STYLE) ALGORITHM
// ---------------------------------------------------------------------------

function hierarchicalDagLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions
): Node<T>[] {
  const nodeWidth = options.nodeWidth || DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight || DEFAULT_NODE_HEIGHT;
  const spacingX = options.spacingX || DEFAULT_SPACING_X;
  const spacingY = options.spacingY || DEFAULT_SPACING_Y;
  const direction = options.direction || 'TB';

  const nodeMap = new Map<string, Node<T>>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // 1. Build adjacency list and valid node IDs
  const validNodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();
  const undirectedAdj = new Map<string, Set<string>>();

  validNodeIds.forEach((id) => {
    adj.set(id, []);
    revAdj.set(id, []);
    undirectedAdj.set(id, new Set());
  });

  edges.forEach((e) => {
    if (validNodeIds.has(e.source) && validNodeIds.has(e.target) && e.source !== e.target) {
      adj.get(e.source)!.push(e.target);
      revAdj.get(e.target)!.push(e.source);
      undirectedAdj.get(e.source)!.add(e.target);
      undirectedAdj.get(e.target)!.add(e.source);
    }
  });

  // 2. Partition into Connected Components
  const visitedComponents = new Set<string>();
  const components: string[][] = [];

  validNodeIds.forEach((id) => {
    if (!visitedComponents.has(id)) {
      const comp: string[] = [];
      const queue = [id];
      visitedComponents.add(id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);

        undirectedAdj.get(curr)?.forEach((neighbor) => {
          if (!visitedComponents.has(neighbor)) {
            visitedComponents.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      components.push(comp);
    }
  });

  // Separate components: subgraphs vs orphan singletons (size = 1 and deg = 0)
  const subgraphs: string[][] = [];
  const orphans: string[] = [];

  components.forEach((comp) => {
    if (comp.length === 1 && (undirectedAdj.get(comp[0])?.size || 0) === 0) {
      orphans.push(comp[0]);
    } else {
      subgraphs.push(comp);
    }
  });

  const positionedNodes: Node<T>[] = [];
  let currentOffsetX = 100;
  let maxComponentHeight = 0;

  // 3. Layout each connected subgraph
  subgraphs.forEach((compNodeIds) => {
    const compSet = new Set(compNodeIds);
    const compAdj = new Map<string, string[]>();
    const compInDegree = new Map<string, number>();

    compNodeIds.forEach((id) => {
      compAdj.set(id, []);
      compInDegree.set(id, 0);
    });

    // Detect cycles via 3-color DFS to form a DAG
    const color = new Map<string, number>(); // 0: white, 1: gray, 2: black
    compNodeIds.forEach((id) => color.set(id, 0));

    const dagEdges: Array<{ from: string; to: string }> = [];

    function dfsCycle(u: string) {
      color.set(u, 1);
      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!compSet.has(v)) continue;
        const vColor = color.get(v);
        if (vColor === 0) {
          dagEdges.push({ from: u, to: v });
          dfsCycle(v);
        } else if (vColor === 2) {
          dagEdges.push({ from: u, to: v });
        }
        // If vColor === 1, it's a back-edge cycle! Reverse it to maintain DAG property
        else if (vColor === 1) {
          dagEdges.push({ from: v, to: u });
        }
      }
      color.set(u, 2);
    }

    compNodeIds.forEach((id) => {
      if (color.get(id) === 0) {
        dfsCycle(id);
      }
    });

    // Populate DAG adjacency & in-degrees
    dagEdges.forEach(({ from, to }) => {
      compAdj.get(from)?.push(to);
      compInDegree.set(to, (compInDegree.get(to) || 0) + 1);
    });

    // Rank Assignment (Longest Path)
    const ranks = new Map<string, number>();
    compNodeIds.forEach((id) => ranks.set(id, 0));

    // Topological Sort using Kahn's algorithm
    const inDegCopy = new Map(compInDegree);
    const queue: string[] = [];
    compNodeIds.forEach((id) => {
      if ((inDegCopy.get(id) || 0) === 0) {
        queue.push(id);
        ranks.set(id, 0);
      }
    });

    // Fallback if queue empty
    if (queue.length === 0 && compNodeIds.length > 0) {
      queue.push(compNodeIds[0]);
    }

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);
      const uRank = ranks.get(u) || 0;

      const children = compAdj.get(u) || [];
      for (const v of children) {
        ranks.set(v, Math.max(ranks.get(v) || 0, uRank + 1));
        const remDeg = (inDegCopy.get(v) || 1) - 1;
        inDegCopy.set(v, remDeg);
        if (remDeg === 0) {
          queue.push(v);
        }
      }
    }

    // Assign any unvisited nodes
    compNodeIds.forEach((id) => {
      if (!ranks.has(id)) ranks.set(id, 0);
    });

    // Group nodes by rank
    const rankGroups = new Map<number, string[]>();
    compNodeIds.forEach((id) => {
      const r = ranks.get(id) || 0;
      if (!rankGroups.has(r)) rankGroups.set(r, []);
      rankGroups.get(r)!.push(id);
    });

    const maxRank = Math.max(...Array.from(rankGroups.keys()), 0);

    // Barycenter Ordering within layers
    for (let r = 1; r <= maxRank; r++) {
      const layer = rankGroups.get(r) || [];
      const prevLayer = rankGroups.get(r - 1) || [];
      const prevPosMap = new Map<string, number>();
      prevLayer.forEach((id, idx) => prevPosMap.set(id, idx));

      layer.sort((a, b) => {
        const parentsA = revAdj.get(a)?.filter((p) => prevPosMap.has(p)) || [];
        const parentsB = revAdj.get(b)?.filter((p) => prevPosMap.has(p)) || [];

        const avgA =
          parentsA.length > 0
            ? parentsA.reduce((sum, p) => sum + (prevPosMap.get(p) || 0), 0) / parentsA.length
            : 0;
        const avgB =
          parentsB.length > 0
            ? parentsB.reduce((sum, p) => sum + (prevPosMap.get(p) || 0), 0) / parentsB.length
            : 0;

        return avgA - avgB;
      });
      rankGroups.set(r, layer);
    }

    // Calculate layer widths and center alignment
    let maxLayerWidth = 0;
    for (let r = 0; r <= maxRank; r++) {
      const layer = rankGroups.get(r) || [];
      const w = layer.length * nodeWidth + Math.max(0, layer.length - 1) * spacingX;
      if (w > maxLayerWidth) maxLayerWidth = w;
    }

    // Position vertices in component
    for (let r = 0; r <= maxRank; r++) {
      const layer = rankGroups.get(r) || [];
      const layerW = layer.length * nodeWidth + Math.max(0, layer.length - 1) * spacingX;
      const startX = currentOffsetX + (maxLayerWidth - layerW) / 2;

      layer.forEach((nodeId, idx) => {
        const origNode = nodeMap.get(nodeId)!;
        let posX = startX + idx * (nodeWidth + spacingX);
        let posY = 100 + r * (nodeHeight + spacingY);

        if (direction === 'LR') {
          // Swap axes for Left-to-Right
          posX = 100 + r * (nodeWidth + spacingX * 1.5);
          posY = currentOffsetX + idx * (nodeHeight + spacingY);
        } else if (direction === 'BT') {
          posY = 100 + (maxRank - r) * (nodeHeight + spacingY);
        } else if (direction === 'RL') {
          posX = 100 + (maxRank - r) * (nodeWidth + spacingX * 1.5);
          posY = currentOffsetX + idx * (nodeHeight + spacingY);
        }

        positionedNodes.push({
          ...origNode,
          position: { x: Math.round(posX), y: Math.round(posY) },
        });
      });
    }

    const compH = (maxRank + 1) * (nodeHeight + spacingY);
    if (compH > maxComponentHeight) maxComponentHeight = compH;
    currentOffsetX += maxLayerWidth + spacingX * 2;
  });

  // 4. Position Orphan Nodes in a Clean Matrix below or beside the graph
  if (orphans.length > 0) {
    const orphanCols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(orphans.length))));
    const orphanStartY = subgraphs.length > 0 ? 100 + maxComponentHeight + 60 : 100;
    const orphanStartX = 100;

    orphans.forEach((orphanId, idx) => {
      const origNode = nodeMap.get(orphanId)!;
      const col = idx % orphanCols;
      const row = Math.floor(idx / orphanCols);

      positionedNodes.push({
        ...origNode,
        position: {
          x: Math.round(orphanStartX + col * (nodeWidth + spacingX)),
          y: Math.round(orphanStartY + row * (nodeHeight + spacingY * 0.75)),
        },
      });
    });
  }

  return positionedNodes;
}

// ---------------------------------------------------------------------------
// 2. FORCE-DIRECTED (FRUCHTERMAN-REINGOLD PHYSICS) ALGORITHM
// ---------------------------------------------------------------------------

function forceDirectedLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions
): Node<T>[] {
  const nodeWidth = options.nodeWidth || DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight || DEFAULT_NODE_HEIGHT;
  const iterations = options.iterations || 100;

  const validIds = new Set(nodes.map((n) => n.id));
  const count = nodes.length;

  // Equilibrium spring distance
  const k = Math.max(280, Math.sqrt((count * (nodeWidth + 100) * (nodeHeight + 100)) / count));

  // Initialize positions (circle seed if clustered at 0,0, or existing pos)
  const pos = new Map<string, { x: number; y: number }>();
  const radius = (k * Math.sqrt(count)) / 2;

  nodes.forEach((n, i) => {
    if (n.position && (n.position.x !== 0 || n.position.y !== 0)) {
      pos.set(n.id, { x: n.position.x, y: n.position.y });
    } else {
      const angle = (2 * Math.PI * i) / count;
      pos.set(n.id, {
        x: 400 + radius * Math.cos(angle),
        y: 300 + radius * Math.sin(angle),
      });
    }
  });

  // Valid edges
  const validEdges = edges.filter(
    (e) => validIds.has(e.source) && validIds.has(e.target) && e.source !== e.target
  );

  let temp = 150;
  const initialTemp = temp;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { dx: number; dy: number }>();
    nodes.forEach((n) => disp.set(n.id, { dx: 0, dy: 0 }));

    // 1. Repulsive forces between all node pairs
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const u = nodes[i].id;
        const v = nodes[j].id;
        const posU = pos.get(u)!;
        const posV = pos.get(v)!;

        let dx = posU.x - posV.x;
        let dy = posU.y - posV.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) {
          dx = (Math.random() - 0.5) * 10;
          dy = (Math.random() - 0.5) * 10;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        // Repulsion force: Fr = k^2 / dist
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        disp.get(u)!.dx += fx;
        disp.get(u)!.dy += fy;
        disp.get(v)!.dx -= fx;
        disp.get(v)!.dy -= fy;

        // Card collision padding box
        if (Math.abs(dx) < nodeWidth + 30 && Math.abs(dy) < nodeHeight + 30) {
          const push = 80;
          disp.get(u)!.dx += (dx >= 0 ? push : -push);
          disp.get(u)!.dy += (dy >= 0 ? push : -push);
          disp.get(v)!.dx -= (dx >= 0 ? push : -push);
          disp.get(v)!.dy -= (dy >= 0 ? push : -push);
        }
      }
    }

    // 2. Attractive forces along connected edges
    validEdges.forEach((e) => {
      const posU = pos.get(e.source)!;
      const posV = pos.get(e.target)!;

      const dx = posV.x - posU.x;
      const dy = posV.y - posU.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

      // Attraction force: Fa = dist^2 / k
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      disp.get(e.source)!.dx += fx;
      disp.get(e.source)!.dy += fy;
      disp.get(e.target)!.dx -= fx;
      disp.get(e.target)!.dy -= fy;
    });

    // 3. Central gravity force to prevent disjoint nodes flying off
    nodes.forEach((n) => {
      const p = pos.get(n.id)!;
      disp.get(n.id)!.dx += (400 - p.x) * 0.04;
      disp.get(n.id)!.dy += (300 - p.y) * 0.04;
    });

    // 4. Apply displacement with temperature limiting
    nodes.forEach((n) => {
      const d = disp.get(n.id)!;
      const dist = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
      if (dist > 0) {
        const limitedDist = Math.min(dist, temp);
        const p = pos.get(n.id)!;
        p.x += (d.dx / dist) * limitedDist;
        p.y += (d.dy / dist) * limitedDist;
      }
    });

    // Cooling schedule (linear simulated annealing)
    temp = initialTemp * (1 - (iter + 1) / iterations);
  }

  // 5. Normalization: shift all nodes to ensure positive coordinates with margin
  let minX = Infinity;
  let minY = Infinity;
  pos.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  });

  const targetOffsetX = 120;
  const targetOffsetY = 100;
  const shiftX = targetOffsetX - minX;
  const shiftY = targetOffsetY - minY;

  return nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      ...n,
      position: {
        x: Math.round(p.x + shiftX),
        y: Math.round(p.y + shiftY),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// 3. GRID MATRIX LAYOUT
// ---------------------------------------------------------------------------

function gridLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  options: LayoutOptions
): Node<T>[] {
  const nodeWidth = options.nodeWidth || DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight || DEFAULT_NODE_HEIGHT;
  const spacingX = options.spacingX || DEFAULT_SPACING_X;
  const spacingY = options.spacingY || DEFAULT_SPACING_Y;

  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
  const startX = 100;
  const startY = 100;

  return nodes.map((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    return {
      ...node,
      position: {
        x: Math.round(startX + col * (nodeWidth + spacingX)),
        y: Math.round(startY + row * (nodeHeight + spacingY)),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// 4. BULK ALIGNMENT & DISTRIBUTION UTILITIES
// ---------------------------------------------------------------------------

export function alignNodes<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedIds: string[],
  alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v',
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodeHeight = DEFAULT_NODE_HEIGHT
): Node<T>[] {
  const idSet = new Set(selectedIds);
  const targetNodes = nodes.filter((n) => idSet.has(n.id));

  if (targetNodes.length < 2) return nodes;

  let targetX = 0;
  let targetY = 0;

  if (alignment === 'left') {
    targetX = Math.min(...targetNodes.map((n) => n.position.x));
  } else if (alignment === 'right') {
    targetX = Math.max(...targetNodes.map((n) => n.position.x));
  } else if (alignment === 'top') {
    targetY = Math.min(...targetNodes.map((n) => n.position.y));
  } else if (alignment === 'bottom') {
    targetY = Math.max(...targetNodes.map((n) => n.position.y));
  } else if (alignment === 'center-h') {
    const avgCenterX =
      targetNodes.reduce((sum, n) => sum + (n.position.x + nodeWidth / 2), 0) / targetNodes.length;
    targetX = avgCenterX - nodeWidth / 2;
  } else if (alignment === 'center-v') {
    const avgCenterY =
      targetNodes.reduce((sum, n) => sum + (n.position.y + nodeHeight / 2), 0) / targetNodes.length;
    targetY = avgCenterY - nodeHeight / 2;
  }

  return nodes.map((node) => {
    if (!idSet.has(node.id)) return node;

    const newPos = { ...node.position };
    if (alignment === 'left' || alignment === 'right' || alignment === 'center-h') {
      newPos.x = Math.round(targetX);
    }
    if (alignment === 'top' || alignment === 'bottom' || alignment === 'center-v') {
      newPos.y = Math.round(targetY);
    }

    return {
      ...node,
      position: newPos,
    };
  });
}

export function distributeNodes<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  selectedIds: string[],
  direction: 'horizontal' | 'vertical'
): Node<T>[] {
  const idSet = new Set(selectedIds);
  const targetNodes = nodes.filter((n) => idSet.has(n.id));

  if (targetNodes.length < 3) return nodes;

  if (direction === 'horizontal') {
    targetNodes.sort((a, b) => a.position.x - b.position.x);
    const minX = targetNodes[0].position.x;
    const maxX = targetNodes[targetNodes.length - 1].position.x;
    const step = (maxX - minX) / (targetNodes.length - 1);

    const posMap = new Map<string, number>();
    targetNodes.forEach((n, idx) => {
      posMap.set(n.id, Math.round(minX + idx * step));
    });

    return nodes.map((node) => {
      if (posMap.has(node.id)) {
        return {
          ...node,
          position: { ...node.position, x: posMap.get(node.id)! },
        };
      }
      return node;
    });
  } else {
    targetNodes.sort((a, b) => a.position.y - b.position.y);
    const minY = targetNodes[0].position.y;
    const maxY = targetNodes[targetNodes.length - 1].position.y;
    const step = (maxY - minY) / (targetNodes.length - 1);

    const posMap = new Map<string, number>();
    targetNodes.forEach((n, idx) => {
      posMap.set(n.id, Math.round(minY + idx * step));
    });

    return nodes.map((node) => {
      if (posMap.has(node.id)) {
        return {
          ...node,
          position: { ...node.position, y: posMap.get(node.id)! },
        };
      }
      return node;
    });
  }
}
