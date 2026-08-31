# Analysis & Implementation Blueprint: Auto-Layout Engine & Canvas View Controls

**Agent**: `explorer_m1_3` (Graph Layout & Canvas Integration Explorer)  
**Milestone**: M1 (Canvas & Relationship Graph Engine)  
**Target Files**:
- `src/lib/services/layout.ts` (Pure Graph Layout Engine)
- `src/lib/components/canvas/CanvasView.svelte` (Canvas Container, Toolbar, Selection & Event Handling)
- `src/lib/stores/campaignStore.svelte.ts` (Store extensions for layout, edge lifecycle, and selection)

---

## 1. Executive Summary & Architectural Overview

The investigation conspiracy board in Mural requires two core canvas capabilities:
1. **Intelligent Auto-Layout Engine (`src/lib/services/layout.ts`)**:
   A dependency-free, high-performance graph layout engine capable of automatically organizing messy node graphs into clear visual structures using three distinct algorithms:
   - **Hierarchical DAG (Sugiyama Layering)**: Detects roots and hierarchy levels, handles cycles safely, minimizes edge crossings via barycenter sorting, and layers factions/locations logically.
   - **Force-Directed (Fruchterman-Reingold Physics)**: Simulates node repulsion (Coulomb's Law) and edge spring attraction (Hooke's Law) with simulated annealing cooling to cluster interrelated clues and NPCs naturally.
   - **Grid / Matrix Layout**: Rapidly aligns disconnected entities into clean matrix blocks.
   - **Alignment & Distribution Utilities**: Bulk alignment (top, bottom, left, right, center-h, center-v) and equidistant distribution.
   - **Component Decomposition**: Partitions disconnected subgraphs (islands) and orphan nodes without overlaps.

2. **Full-Featured Canvas View (`src/lib/components/canvas/CanvasView.svelte`)**:
   Built with `@xyflow/svelte` and Svelte 5 Runes, supporting:
   - Registration of custom `nodeTypes` (`entityNode: EntityNode`) and `edgeTypes` (`customLabeledEdge: CustomLabeledEdge`).
   - Partial marquee multi-selection (`selectionMode="partial"`), multi-node group dragging, and group deletion.
   - Floating GM action toolbar with quick entity creation buttons (`+ NPC`, `+ Facção`, `+ Local`, `+ Segredo`), Auto-Layout dropdown, selection alignment toolbar, and viewport controls (`Fit View`, `Zoom In`, `Zoom Out`, `Reset`).
   - Typed connection handler (`handleConnect`) generating rich `CanvasRelationEdgeData` (`allied`, `hostile`, `secret`, `neutral`, `investigates`, `custom`).
   - Edge click / double-click event handling triggering `EditEdgeModal.svelte`.

---

## 2. Graph Layout Algorithms & Mathematical Formulations

### 2.1 Hierarchical DAG Layout (Sugiyama Framework)

For RPG conspiracy boards, factions command subordinates, locations contain sub-locations, and clues lead to secrets. The hierarchical layout reflects these directed dependencies.

```
+-----------------------------------------------------------------------------------+
|                           SUGIYAMA DAG LAYOUT PIPELINE                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Input Graph G = (V, E)]                                                         |
|         │                                                                         |
|         ▼ Step 1: Connected Component Partitioning                                |
|  Partition V into connected subgraphs C_1, C_2, ... C_k and isolated orphans O     |
|         │                                                                         |
|         ▼ Step 2: Cycle Detection & Feedback Arc Set (FAS)                        |
|  3-Color DFS (White/Gray/Black). Reverse Gray-to-Gray back-edges temporarily      |
|         │                                                                         |
|         ▼ Step 3: Topological Layering (Rank Assignment)                          |
|  Roots (in-degree = 0) -> Rank 0. Rank(v) = max_{(u,v) in E} (Rank(u) + 1)        |
|         │                                                                         |
|         ▼ Step 4: Layer Crossing Reduction (Barycenter Heuristic)                 |
|  For layer L_k, sort nodes by average position of neighbors in L_{k-1}            |
|         │                                                                         |
|         ▼ Step 5: Coordinate Assignment & Layer Centering                         |
|  X_i = rankIndex * (nodeWidth + spacingX), Y_i = rank * (nodeHeight + spacingY)   |
|  Center each layer relative to widest layer for balanced symmetry                |
|         │                                                                         |
|         ▼ Step 6: Multi-Component Flow & Orphan Packing                           |
|  Pack C_1, C_2 side-by-side (gap = 140px); Place orphans in neat 4-col grid       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Mathematical Steps:
1. **Cycle Breaking**:
   Let directed graph $G = (V, E)$. Perform Depth-First Search with vertex coloring:
   - `0 (WHITE)`: Unvisited
   - `1 (GRAY)`: In current recursion stack
   - `2 (BLACK)`: Fully explored
   
   If an edge $(u, v)$ points to a `GRAY` node $v$, $(u, v)$ is a back-edge creating a directed cycle. Reverse this edge in the ranking DAG: $E_{DAG} = (E \setminus \{(u, v)\}) \cup \{(v, u)\}$.

2. **Topological Layering**:
   Assign each vertex $v \in V$ an integer rank $L(v) \ge 0$:
   - For all vertices with $\text{in-degree}(v) = 0$ in $E_{DAG}$: $L(v) = 0$.
   - Using Kahn's algorithm or longest path propagation:
     $$L(v) = \max_{(u, v) \in E_{DAG}} (L(u) + 1)$$

3. **Barycenter Ordering (Crossing Minimization)**:
   For layers $k = 1, 2, \dots, K$:
   Let $\text{pos}(u)$ be the index of node $u$ in layer $k-1$.
   The barycenter $B(v)$ of node $v \in L_k$ with in-neighbors $N^-(v) \subseteq L_{k-1}$ is:
   $$B(v) = \begin{cases} \frac{1}{|N^-(v)|} \sum_{u \in N^-(v)} \text{pos}(u) & \text{if } |N^-(v)| > 0 \\ \text{index}(v) & \text{otherwise} \end{cases}$$
   Sort vertices in $L_k$ by ascending $B(v)$.

4. **Coordinate Assignment**:
   Given standard node dimensions ($W = 260\text{px}$, $H = 140\text{px}$) and gaps ($\Delta X = 60\text{px}$, $\Delta Y = 100\text{px}$):
   - For Top-to-Bottom (`TB`):
     $$\text{layerWidth}(k) = |L_k| \cdot W + (|L_k| - 1) \cdot \Delta X$$
     $$\text{maxWidth} = \max_k \text{layerWidth}(k)$$
     $$\text{startX}(k) = \frac{\text{maxWidth} - \text{layerWidth}(k)}{2}$$
     $$X(v, i) = \text{startX}(k) + i \cdot (W + \Delta X)$$
     $$Y(v, k) = k \cdot (H + \Delta Y)$$
   - For Left-to-Right (`LR`): Swap $X$ and $Y$ coordinates.

---

### 2.2 Force-Directed Physics Layout (Fruchterman-Reingold)

For complex, non-hierarchical web-of-intrigue investigation boards, physics simulation creates organic clusters where closely allied or hostile factions gravitate together while unrelated nodes repel.

```
+-----------------------------------------------------------------------------------+
|                        FORCE-DIRECTED PHYSICS ENGINE                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Initial Positions: Circular / Existing Box Layout]                              |
|         │                                                                         |
|         ▼ Loop Iterations t = 1 to N (default N = 100)                             |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │ 1. Coulomb Repulsion Force (All pairs u != v):                               │  |
|  │    F_rep(u, v) = (k^2 / d(u, v)) * norm(u - v)                              │  |
|  │                                                                             │  |
|  │ 2. Hooke Spring Attraction Force (Connected pairs (u, v) in E):             │  |
|  │    F_attr(u, v) = (d(u, v)^2 / k) * norm(v - u)                             │  |
|  │                                                                             │  |
|  │ 3. Center Gravity Force (Prevent drift):                                    │  |
|  │    F_grav(u) = 0.04 * (center - pos(u))                                     │  |
|  │                                                                             │  |
|  │ 4. Node Collision Box Repulsion (Prevent card overlap):                     │  |
|  │    If dx < W + pad and dy < H + pad, add strong separating push             │  |
|  │                                                                             │  |
|  │ 5. Simulated Annealing Temperature Cooling:                                 │  |
|  │    Temp(t) = Temp_0 * (1 - t / N)                                           │  |
|  │    displacement(u) = norm(F_total(u)) * min(|F_total(u)|, Temp(t))          │  |
|  │    pos(u) = pos(u) + displacement(u)                                        │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|         │                                                                         |
|         ▼ Post-Processing: Normalization & Centering                              |
|  Shift bounding box to origin (150, 120) with positive canvas coordinates         |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Mathematical Steps:
- Optimal spring distance:
  $$k = 1.2 \cdot \sqrt{\frac{\text{Area}}{|V|}} \approx 320\text{px}$$
- Repulsive force magnitude:
  $$f_r(d) = \frac{k^2}{\max(d, 1)}$$
- Attractive force magnitude:
  $$f_a(d) = \frac{d^2}{k}$$
- Temperature cooling:
  $$T(t) = T_0 \cdot \left(1 - \frac{t}{N}\right), \quad T_0 = \frac{\sqrt{\text{Area}}}{8}$$

---

### 2.3 Grid Layout & Alignment Utilities

1. **Grid Matrix Layout**:
   - Number of columns: $C = \max(2, \lceil\sqrt{|V|}\rceil)$.
   - Position for $i$-th node ($0 \le i < |V|$):
     $$\text{col} = i \pmod C, \quad \text{row} = \lfloor i / C \rfloor$$
     $$X_i = X_0 + \text{col} \cdot (W + \Delta X), \quad Y_i = Y_0 + \text{row} \cdot (H + \Delta Y)$$

2. **Alignment Operations**:
   Given selected nodes $S \subseteq V$:
   - **Align Left**: $X_i = \min_{u \in S} X_u$
   - **Align Right**: $X_i = \max_{u \in S} (X_u + W_u) - W_i$
   - **Align Top**: $Y_i = \min_{u \in S} Y_u$
   - **Align Bottom**: $Y_i = \max_{u \in S} (Y_u + H_u) - H_i$
   - **Align Center H**: $X_i = \frac{1}{|S|} \sum_{u \in S} \left(X_u + \frac{W_u}{2}\right) - \frac{W_i}{2}$
   - **Align Center V**: $Y_i = \frac{1}{|S|} \sum_{u \in S} \left(Y_u + \frac{H_u}{2}\right) - \frac{H_i}{2}$

3. **Distribution Operations**:
   - **Distribute Horizontal**: Sort $S$ by $X$-coordinate. Compute available span between leftmost $X_{min}$ and rightmost $X_{max}$. Space intermediate nodes with step $\frac{X_{max} - X_{min}}{|S| - 1}$.
   - **Distribute Vertical**: Sort $S$ by $Y$-coordinate. Space intermediate nodes with step $\frac{Y_{max} - Y_{min}}{|S| - 1}$.

---

## 3. Complete Implementation Blueprint: `src/lib/services/layout.ts`

Here is the complete, self-contained implementation code for `src/lib/services/layout.ts`:

```typescript
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

  // Separate components: subgraphs (size > 1 or with self/cross edges) vs orphan singletons (size = 1 and deg = 0)
  const subgraphs = components.filter((comp) => comp.length > 1);
  const orphans = components.filter((comp) => comp.length === 1 && (undirectedAdj.get(comp[0])?.size || 0) === 0).map((c) => c[0]);

  // If a 1-node component has an edge (e.g. self-loop), treat as subgraph
  components.forEach((comp) => {
    if (comp.length === 1 && (undirectedAdj.get(comp[0])?.size || 0) > 0) {
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
          const temp = posX;
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
```

---

## 4. Complete Implementation Blueprint: `src/lib/components/canvas/CanvasView.svelte`

Below is the complete, high-fidelity integration design for `src/lib/components/canvas/CanvasView.svelte`:

```svelte
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    SvelteFlowProvider,
    useSvelteFlow,
    SelectionMode,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
    type Node,
    type Edge,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './nodes/EntityNode.svelte';
  import CustomLabeledEdge from './edges/CustomLabeledEdge.svelte';
  import EditEntityModal from './EditEntityModal.svelte';
  import EditEdgeModal from './EditEdgeModal.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import {
    autoLayoutNodes,
    alignNodes,
    distributeNodes,
    type LayoutAlgorithm,
    type LayoutDirection,
  } from '../../services/layout';
  import type { EntityCategory, CanvasRelationEdgeData } from '../../types';
  import {
    User,
    Shield,
    MapPin,
    Skull,
    Plus,
    Sparkles,
    Maximize2,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    LayoutGrid,
    GitFork,
    Activity,
    AlignTop,
    AlignCenter,
    AlignLeft,
    AlignVerticalSpaceAround,
    AlignHorizontalSpaceAround,
    Trash2,
    ChevronDown,
  } from 'lucide-svelte';
  import { get } from 'svelte/store';

  // 1. Register Custom Node & Edge Types
  const nodeTypes: NodeTypes = {
    entityNode: EntityNode as any,
  };

  const edgeTypes: EdgeTypes = {
    customLabeledEdge: CustomLabeledEdge as any,
    smoothstep: CustomLabeledEdge as any,
  };

  const nodesStore = campaignStore.nodes;
  const edgesStore = campaignStore.edges;

  // Svelte Flow flow control instance
  const { fitView, zoomIn, zoomOut, setZoom } = useSvelteFlow();

  // Local Reactive State using Svelte 5 Runes
  let showLayoutDropdown = $state(false);
  let activeLayoutAlgo = $state<LayoutAlgorithm>('hierarchical');

  // Derive selection state
  const selectedNodes = $derived($nodesStore.filter((n) => n.selected));
  const selectedCount = $derived(selectedNodes.length);

  // 2. Quick Entity Creation Handler
  function addQuickEntity(type: EntityCategory) {
    const titles: Record<EntityCategory, string> = {
      npc: 'Novo NPC',
      faction: 'Nova Facção',
      location: 'Novo Local',
      secret: 'Novo Segredo',
    };
    const subtitles: Record<EntityCategory, string> = {
      npc: 'NPC',
      faction: 'FACÇÃO',
      location: 'LOCAL',
      secret: 'SEGREDO',
    };
    const colors: Record<EntityCategory, string> = {
      npc: '#d4a359',
      faction: '#a855f7',
      location: '#38bdf8',
      secret: '#f87171',
    };

    // Stagger spawn coordinates near center
    const x = 280 + (Math.random() * 120 - 60);
    const y = 180 + (Math.random() * 120 - 60);

    campaignStore.addEntityNode(
      {
        category: type,
        title: titles[type],
        subtitle: subtitles[type],
        description: 'Clica duas vezes para editar a descrição e notas...',
        colorTheme: colors[type],
        isSecret: type === 'secret',
      },
      x,
      y
    );
  }

  // 3. Typed Connection Lifecycle Handler
  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const newEdge: Edge<CanvasRelationEdgeData> = {
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'customLabeledEdge',
      data: {
        label: 'ligado a',
        relationType: 'neutral',
        pathType: 'smoothstep',
        bidirectional: false,
        notes: '',
      },
    };

    edgesStore.update((list) => [...list, newEdge]);
  }

  // 4. Auto-Layout Application Trigger
  function applyLayout(algorithm: LayoutAlgorithm = 'hierarchical', direction: LayoutDirection = 'TB') {
    activeLayoutAlgo = algorithm;
    showLayoutDropdown = false;

    const currentNodes = get(nodesStore);
    const currentEdges = get(edgesStore);

    const result = autoLayoutNodes(currentNodes, currentEdges, {
      algorithm,
      direction,
      nodeWidth: 260,
      nodeHeight: 140,
      spacingX: 70,
      spacingY: 100,
      iterations: 100,
    });

    nodesStore.set(result.nodes);

    // Smoothly animate viewport to fit the freshly organized graph
    setTimeout(() => {
      fitView({ duration: 500, padding: 0.15 });
    }, 50);
  }

  // 5. Bulk Alignment & Distribution Handlers
  function handleAlign(alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') {
    if (selectedCount < 2) return;
    const currentNodes = get(nodesStore);
    const selectedIds = selectedNodes.map((n) => n.id);
    const aligned = alignNodes(currentNodes, selectedIds, alignment);
    nodesStore.set(aligned);
  }

  function handleDistribute(direction: 'horizontal' | 'vertical') {
    if (selectedCount < 3) return;
    const currentNodes = get(nodesStore);
    const selectedIds = selectedNodes.map((n) => n.id);
    const distributed = distributeNodes(currentNodes, selectedIds, direction);
    nodesStore.set(distributed);
  }

  // 6. Delete Selected Elements Handler
  function handleDeleteSelected() {
    if (selectedCount === 0) return;
    const idsToDelete = new Set(selectedNodes.map((n) => n.id));
    nodesStore.update((list) => list.filter((n) => !idsToDelete.has(n.id)));
    edgesStore.update((list) => list.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
  }

  // 7. Keyboard Shortcuts (Delete / Backspace for multi-delete)
  function handleKeyDown(event: KeyboardEvent) {
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)
    ) {
      if (selectedCount > 0) {
        event.preventDefault();
        handleDeleteSelected();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="w-full h-full bg-[#0b0d11] relative overflow-hidden select-none">
  <!-- Top Floating Master Toolbar -->
  <div class="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
    <!-- Group 1: Entity Creation Buttons -->
    <div class="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl">
      <span class="text-[10px] font-bold text-zinc-500 uppercase px-1.5 hidden sm:inline">Adicionar:</span>

      <button
        onclick={() => addQuickEntity('npc')}
        class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Personagem / NPC"
      >
        <User class="w-3 h-3" />
        <span>+ NPC</span>
      </button>

      <button
        onclick={() => addQuickEntity('faction')}
        class="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Facção / Organização"
      >
        <Shield class="w-3 h-3" />
        <span>+ Facção</span>
      </button>

      <button
        onclick={() => addQuickEntity('location')}
        class="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Local / Região"
      >
        <MapPin class="w-3 h-3" />
        <span>+ Local</span>
      </button>

      <button
        onclick={() => addQuickEntity('secret')}
        class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Pista / Segredo Oculto"
      >
        <Skull class="w-3 h-3" />
        <span>+ Segredo</span>
      </button>
    </div>

    <!-- Group 2: Auto-Layout Engine Dropdown -->
    <div class="relative">
      <div class="flex items-center rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl p-1">
        <button
          onclick={() => applyLayout('hierarchical')}
          class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          title="Organizar Grafo Automaticamente"
        >
          <Sparkles class="w-3 h-3 text-indigo-400" />
          <span>Auto-Layout</span>
        </button>

        <button
          onclick={() => (showLayoutDropdown = !showLayoutDropdown)}
          class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition cursor-pointer"
          title="Escolher Algoritmo de Auto-Organização"
        >
          <ChevronDown class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Layout Dropdown Menu -->
      {#if showLayoutDropdown}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          onclick={() => (showLayoutDropdown = false)}
          class="fixed inset-0 z-20 cursor-default"
        ></div>
        <div class="absolute left-0 top-full mt-1.5 w-56 rounded-xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-1">Algoritmo de Organização</div>

          <button
            onclick={() => applyLayout('hierarchical', 'TB')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'hierarchical' ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <GitFork class="w-3.5 h-3.5 text-indigo-400" />
            <div>
              <div>Hierárquico (DAG)</div>
              <div class="text-[10px] text-zinc-500">Fluxo vertical de cima para baixo</div>
            </div>
          </button>

          <button
            onclick={() => applyLayout('hierarchical', 'LR')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-zinc-300 hover:bg-zinc-800"
          >
            <GitFork class="w-3.5 h-3.5 text-indigo-400 rotate-90" />
            <div>
              <div>Hierárquico (Esquerda-Direita)</div>
              <div class="text-[10px] text-zinc-500">Fluxo horizontal expandido</div>
            </div>
          </button>

          <button
            onclick={() => applyLayout('force')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'force' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <Activity class="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div>Orgânico (Física / Forças)</div>
              <div class="text-[10px] text-zinc-500">Agrupa nós relacionados por gravidade</div>
            </div>
          </button>

          <button
            onclick={() => applyLayout('grid')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'grid' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <LayoutGrid class="w-3.5 h-3.5 text-sky-400" />
            <div>
              <div>Grelha / Matriz</div>
              <div class="text-[10px] text-zinc-500">Distribuição uniforme em linhas e colunas</div>
            </div>
          </button>
        </div>
      {/if}
    </div>

    <!-- Group 3: Contextual Selection Actions (Appears when >= 2 nodes selected) -->
    {#if selectedCount >= 2}
      <div class="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-amber-500/40 backdrop-blur-md shadow-xl animate-in fade-in duration-150">
        <span class="text-[10px] font-bold text-amber-400 uppercase px-1.5">{selectedCount} selecionados</span>

        <button
          onclick={() => handleAlign('top')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar ao Topo"
        >
          <AlignTop class="w-3.5 h-3.5" />
        </button>

        <button
          onclick={() => handleAlign('center-h')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar ao Centro Horizontal"
        >
          <AlignCenter class="w-3.5 h-3.5" />
        </button>

        <button
          onclick={() => handleAlign('left')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar à Esquerda"
        >
          <AlignLeft class="w-3.5 h-3.5" />
        </button>

        {#if selectedCount >= 3}
          <button
            onclick={() => handleDistribute('horizontal')}
            class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
            title="Distribuir Horizontalmente"
          >
            <AlignHorizontalSpaceAround class="w-3.5 h-3.5" />
          </button>
        {/if}

        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>

        <button
          onclick={handleDeleteSelected}
          class="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          title="Eliminar nós selecionados (Delete)"
        >
          <Trash2 class="w-3 h-3" />
          <span>Eliminar</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Top-Right Floating Viewport Controls -->
  <div class="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl">
    <button
      onclick={() => fitView({ duration: 400, padding: 0.2 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Ajustar Vista (Fit View)"
    >
      <Maximize2 class="w-3.5 h-3.5" />
    </button>

    <button
      onclick={() => zoomIn({ duration: 200 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Aumentar Zoom (+)"
    >
      <ZoomIn class="w-3.5 h-3.5" />
    </button>

    <button
      onclick={() => zoomOut({ duration: 200 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Diminuir Zoom (-)"
    >
      <ZoomOut class="w-3.5 h-3.5" />
    </button>

    <button
      onclick={() => setZoom(1, { duration: 200 })}
      class="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Zoom 100%"
    >
      1:1
    </button>
  </div>

  <!-- Empty Canvas Watermark -->
  {#if $nodesStore.length === 0}
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
      <div class="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-center space-y-2 max-w-sm pointer-events-auto backdrop-blur-sm shadow-2xl">
        <div class="w-10 h-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
          <Plus class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-semibold text-zinc-200">Quadro de Investigação Vazio</h3>
        <p class="text-xs text-zinc-400 leading-relaxed">
          Clica nos botões da barra superior para adicionar o teu primeiro NPC, Facção, Local ou Segredo!
        </p>
      </div>
    </div>
  {/if}

  <!-- Main SvelteFlow Graph Canvas -->
  <SvelteFlow
    nodes={nodesStore}
    edges={edgesStore}
    {nodeTypes}
    {edgeTypes}
    onconnect={handleConnect}
    selectionMode={SelectionMode.Partial}
    panOnDrag={true}
    selectionKey="Shift"
    nodesDraggable={true}
    fitView
    class="bg-[#0b0d11]"
  >
    <Background gap={28} size={1.2} bgColor="#0b0d11" patternColor="#222733" />
    <Controls class="!bg-zinc-900 !border-zinc-800 !text-zinc-200 fill-zinc-200" showZoom={false} showFitView={false} />
    <MiniMap
      nodeColor="#3f3f46"
      maskColor="rgba(11, 13, 17, 0.85)"
      class="!bg-zinc-950 !border !border-zinc-800/90 rounded-lg overflow-hidden"
    />
  </SvelteFlow>

  <!-- Entity & Edge Editing Modals -->
  <EditEntityModal />
  <EditEdgeModal />
</div>
```

---

## 5. CampaignStore Extensions Blueprint (`campaignStore.svelte.ts`)

To ensure seamless coordination between canvas interaction, node/edge editing modals, and local-first persistence, `campaignStore.svelte.ts` should incorporate the following methods:

```typescript
// Edge Editing Modal State
editingEdge = $state<CanvasRelationEdgeData & { id: string } | null>(null);

openEdgeEditor(edge: Edge<CanvasRelationEdgeData>) {
  this.editingEdge = {
    id: edge.id,
    label: edge.data?.label || edge.label || 'ligação',
    relationType: edge.data?.relationType || 'neutral',
    pathType: edge.data?.pathType || 'smoothstep',
    bidirectional: edge.data?.bidirectional || false,
    notes: edge.data?.notes || '',
  };
}

closeEdgeEditor() {
  this.editingEdge = null;
}

updateEdgeData(id: string, partial: Partial<CanvasRelationEdgeData>) {
  this.edges.update((list) =>
    list.map((edge) => {
      if (edge.id === id) {
        return {
          ...edge,
          label: partial.label !== undefined ? partial.label : edge.label,
          data: {
            ...edge.data,
            ...partial,
          },
        };
      }
      return edge;
    })
  );
}

deleteEdge(id: string) {
  this.edges.update((list) => list.filter((e) => e.id !== id));
  if (this.editingEdge?.id === id) {
    this.editingEdge = null;
  }
}
```

---

## 6. Verification and Test Strategy

### Unit & Algorithmic Verification
1. **Hierarchical DAG**:
   - Verify zero node overlaps on cyclic graphs (`A -> B -> C -> A`).
   - Verify proper vertical layering ($Y_0 < Y_1 < Y_2$).
   - Verify multi-component separation with 2 independent subgraphs and 3 isolated nodes.
2. **Force-Directed Physics**:
   - Verify that 10 connected nodes reach equilibrium within 100 iterations.
   - Verify bounding box normalization remains strictly positive ($X \ge 100$, $Y \ge 100$).
3. **Canvas Multi-Selection**:
   - Verify `selectionMode="partial"` properly selects partially enclosed nodes during Shift+Drag marquee.
   - Verify bulk align top sets equal $Y$-coordinates for all selected nodes.
   - Verify Backspace/Delete triggers multi-deletion.
4. **Clean Build Check**:
   - Run `npx svelte-check --tsconfig ./tsconfig.json` to confirm 0 TypeScript/Svelte errors.
   - Run `npm run build` to confirm 0 Vite compilation errors.
