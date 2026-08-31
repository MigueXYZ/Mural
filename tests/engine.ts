/**
 * Mural (OrdemTools) - Core Subsystem Engine & Specification Oracles
 * Pure functional reference implementation of all business logic,
 * mathematical calculations, graph algorithms, and storage pipelines
 * defined across PROJECT.md, spec_r1_r2.md, and spec_r3_r4.md.
 */

import type {
  CampaignData,
  ThreatClock,
  LoreEntry,
  TimelineMarker,
  EntityNodeData,
  EntityType,
} from '../src/lib/types';
import type { Node, Edge } from '@xyflow/svelte';

// ============================================================================
// 1. Entity Node & Graph Engine
// ============================================================================

export type RelationType = 'neutral' | 'allied' | 'hostile' | 'secret' | 'family' | 'financial' | 'custom';
export type EdgePathType = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasRelationEdgeData {
  label: string;
  relationType: RelationType;
  pathType?: EdgePathType;
  bidirectional?: boolean;
  notes?: string;
  animated?: boolean;
  color?: string;
}

export function createEntityNode(
  data: Partial<EntityNodeData> & { type: EntityType; title: string },
  x = 200,
  y = 150
): Node<EntityNodeData> {
  const defaultColors: Record<EntityType, string> = {
    npc: '#d4a359',
    faction: '#a855f7',
    location: '#38bdf8',
    secret: '#f87171',
    clue: '#f87171',
  };

  const isSecret = Boolean(data.isSecret || data.type === 'secret');
  const id = data.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    type: 'entityNode',
    position: { x, y },
    data: {
      id,
      type: data.type,
      title: data.title,
      subtitle: data.subtitle || data.type.toUpperCase(),
      description: data.description || '',
      tags: data.tags ? [...data.tags] : [],
      isSecret,
      revealed: data.revealed ?? !isSecret,
      color: data.color || defaultColors[data.type] || '#d4a359',
      statusText: data.statusText,
      icon: data.icon,
    },
  };
}

export function createSemanticEdge(
  source: string,
  target: string,
  label = 'ligação',
  relationType: RelationType = 'neutral',
  pathType: EdgePathType = 'smoothstep'
): Edge {
  return {
    id: `e-${source}-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    target,
    type: pathType,
    label,
    data: {
      label,
      relationType,
      pathType,
    },
  };
}

export function deleteNodeWithIncidentEdges(
  nodes: Node<EntityNodeData>[],
  edges: Edge[],
  nodeIdToDelete: string
): { nodes: Node<EntityNodeData>[]; edges: Edge[]; deletedEdgesCount: number } {
  const initialEdgeCount = edges.length;
  const filteredNodes = nodes.filter((n) => n.id !== nodeIdToDelete);
  const filteredEdges = edges.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete);
  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    deletedEdgesCount: initialEdgeCount - filteredEdges.length,
  };
}

export function applyGroupDisplacement(
  nodes: Node<EntityNodeData>[],
  selectedIds: string[],
  deltaX: number,
  deltaY: number
): Node<EntityNodeData>[] {
  return nodes.map((node) => {
    if (selectedIds.includes(node.id)) {
      return {
        ...node,
        position: {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY,
        },
      };
    }
    return node;
  });
}

export function alignNodes(
  nodes: Node<EntityNodeData>[],
  selectedIds: string[],
  alignment: 'align-top' | 'align-left' | 'align-center-x' | 'distribute-h'
): Node<EntityNodeData>[] {
  const selected = nodes.filter((n) => selectedIds.includes(n.id));
  if (selected.length < 2) return nodes;

  if (alignment === 'align-top') {
    const minY = Math.min(...selected.map((n) => n.position.y));
    return nodes.map((n) => (selectedIds.includes(n.id) ? { ...n, position: { ...n.position, y: minY } } : n));
  }

  if (alignment === 'align-left') {
    const minX = Math.min(...selected.map((n) => n.position.x));
    return nodes.map((n) => (selectedIds.includes(n.id) ? { ...n, position: { ...n.position, x: minX } } : n));
  }

  if (alignment === 'align-center-x') {
    const avgX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length;
    return nodes.map((n) => (selectedIds.includes(n.id) ? { ...n, position: { ...n.position, x: avgX } } : n));
  }

  if (alignment === 'distribute-h') {
    const sorted = [...selected].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const step = (maxX - minX) / (sorted.length - 1);

    const posMap = new Map<string, number>();
    sorted.forEach((n, idx) => posMap.set(n.id, minX + idx * step));

    return nodes.map((n) => {
      if (posMap.has(n.id)) {
        return { ...n, position: { ...n.position, x: posMap.get(n.id)! } };
      }
      return n;
    });
  }

  return nodes;
}

// ============================================================================
// 2. Auto-Layout Algorithms
// ============================================================================

export function calculateHierarchicalDag(
  nodes: Node<EntityNodeData>[],
  edges: Edge[],
  options: { levelGap?: number; nodeGap?: number } = {}
): Node<EntityNodeData>[] {
  if (nodes.length === 0) return [];
  const levelGap = options.levelGap || 180;
  const nodeGap = options.nodeGap || 260;

  // Build in-degree and adjacency map
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach((e) => {
    if (adj[e.source] && inDegree[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target]++;
    }
  });

  // Assign levels via BFS / topological rank
  const levels: Record<string, number> = {};
  const queue: string[] = [];

  nodes.forEach((n) => {
    if (inDegree[n.id] === 0) {
      levels[n.id] = 0;
      queue.push(n.id);
    }
  });

  // Fallback for cyclic graphs or no root nodes: pick first node
  if (queue.length === 0 && nodes.length > 0) {
    levels[nodes[0].id] = 0;
    queue.push(nodes[0].id);
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const currLevel = levels[curr] || 0;

    for (const next of adj[curr] || []) {
      levels[next] = Math.max(levels[next] || 0, currLevel + 1);
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  // Ensure all unvisited nodes get assigned level 0 or maxLevel + 1
  nodes.forEach((n) => {
    if (levels[n.id] === undefined) {
      levels[n.id] = 0;
    }
  });

  // Group by levels
  const levelBuckets: Record<number, string[]> = {};
  nodes.forEach((n) => {
    const lvl = levels[n.id];
    if (!levelBuckets[lvl]) levelBuckets[lvl] = [];
    levelBuckets[lvl].push(n.id);
  });

  // Assign coordinates
  const newPositions: Record<string, { x: number; y: number }> = {};
  Object.keys(levelBuckets).forEach((lvlStr) => {
    const lvl = parseInt(lvlStr, 10);
    const bucket = levelBuckets[lvl];
    const totalWidth = (bucket.length - 1) * nodeGap;
    const startX = 400 - totalWidth / 2;

    bucket.forEach((nodeId, idx) => {
      newPositions[nodeId] = {
        x: startX + idx * nodeGap,
        y: 100 + lvl * levelGap,
      };
    });
  });

  return nodes.map((n) => ({
    ...n,
    position: newPositions[n.id] || n.position,
  }));
}

export function calculateForceDirectedLayout(
  nodes: Node<EntityNodeData>[],
  edges: Edge[],
  iterations = 40
): Node<EntityNodeData>[] {
  if (nodes.length <= 1) return nodes;

  const positions: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  nodes.forEach((n) => {
    positions[n.id] = { x: n.position.x, y: n.position.y, vx: 0, vy: 0 };
  });

  const kRepulsion = 15000;
  const kSpring = 0.05;
  const desiredLength = 220;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = Math.max(0.1, 1 - iter / iterations);

    // Node repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const idA = nodes[i].id;
        const idB = nodes[j].id;
        const pA = positions[idA];
        const pB = positions[idB];

        let dx = pA.x - pB.x;
        let dy = pA.y - pB.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 600) continue;

        const force = (kRepulsion / (dist * dist)) * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        pA.vx += fx;
        pA.vy += fy;
        pB.vx -= fx;
        pB.vy -= fy;
      }
    }

    // Edge attraction
    for (const edge of edges) {
      const pA = positions[edge.source];
      const pB = positions[edge.target];
      if (!pA || !pB) continue;

      let dx = pB.x - pA.x;
      let dy = pB.y - pA.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const displacement = dist - desiredLength;
      const force = displacement * kSpring * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      pA.vx += fx;
      pA.vy += fy;
      pB.vx -= fx;
      pB.vy -= fy;
    }

    // Apply velocities and clamp movement
    nodes.forEach((n) => {
      const p = positions[n.id];
      const maxMove = 25 * temp;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      const move = Math.min(speed, maxMove);

      p.x += (p.vx / speed) * move;
      p.y += (p.vy / speed) * move;
      p.vx = 0;
      p.vy = 0;
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: {
      x: Math.round(positions[n.id].x),
      y: Math.round(positions[n.id].y),
    },
  }));
}

// ============================================================================
// 3. Mathematical SVG Threat Clocks
// ============================================================================

export interface ClockSegmentCalculation {
  index: number;
  isFilled: boolean;
  strokeDasharray: string;
  rotation: number;
  segmentLength: number;
  circumference: number;
  startAngleDeg: number;
  endAngleDeg: number;
}

export function calculateClockSegments(
  totalSegments: number,
  filledSegments: number,
  radius = 13,
  center = 16,
  customGap?: number
): ClockSegmentCalculation[] {
  const total = Math.max(1, totalSegments);
  const filled = Math.max(0, Math.min(total, filledSegments));
  const circumference = 2 * Math.PI * radius;

  // Gap scaling as specified in spec_r3_r4.md §4.1.2
  let gap = customGap !== undefined ? customGap : total <= 8 ? 2.0 : total === 10 ? 1.5 : 1.2;
  const totalGap = total * gap;
  const segmentLength = Math.max(0.1, (circumference - totalGap) / total);

  const angleStep = 360 / total;
  const segments: ClockSegmentCalculation[] = [];

  for (let i = 0; i < total; i++) {
    const isFilled = i < filled;
    const strokeDasharray = `${segmentLength.toFixed(2)} ${(circumference - segmentLength).toFixed(2)}`;
    const rotation = angleStep * i - 90;
    const startAngleDeg = angleStep * i;
    const endAngleDeg = angleStep * (i + 1);

    segments.push({
      index: i,
      isFilled,
      strokeDasharray,
      rotation,
      segmentLength,
      circumference,
      startAngleDeg,
      endAngleDeg,
    });
  }

  return segments;
}

export function calculateAnnularSectorPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleRad: number,
  endAngleRad: number
): string {
  const p1x = cx + rOuter * Math.cos(startAngleRad);
  const p1y = cy + rOuter * Math.sin(startAngleRad);
  const p2x = cx + rOuter * Math.cos(endAngleRad);
  const p2y = cy + rOuter * Math.sin(endAngleRad);
  const p3x = cx + rInner * Math.cos(endAngleRad);
  const p3y = cy + rInner * Math.sin(endAngleRad);
  const p4x = cx + rInner * Math.cos(startAngleRad);
  const p4y = cy + rInner * Math.sin(startAngleRad);

  const largeArc = endAngleRad - startAngleRad > Math.PI ? 1 : 0;

  return `M ${p1x.toFixed(2)} ${p1y.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2x.toFixed(2)} ${p2y.toFixed(2)} L ${p3x.toFixed(2)} ${p3y.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4x.toFixed(2)} ${p4y.toFixed(2)} Z`;
}

export function createThreatClock(
  title: string,
  totalSegments: 4 | 6 | 8 | 10 | 12 | number,
  options: { consequence?: string; category?: string; initialFilled?: number } = {}
): ThreatClock & { isCompleted: boolean; consequence?: string; category?: string } {
  const allowedSegments = [4, 6, 8, 10, 12];
  if (!allowedSegments.includes(totalSegments)) {
    throw new Error(`Invalid totalSegments: ${totalSegments}. Must be one of [4, 6, 8, 10, 12].`);
  }
  const filled = Math.max(0, Math.min(totalSegments, options.initialFilled || 0));
  return {
    id: `clock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim() || 'Nova Ameaça',
    totalSegments,
    filledSegments: filled,
    isCompleted: filled === totalSegments,
    consequence: options.consequence,
    category: options.category || 'threat',
  };
}

export function stepThreatClock(
  clock: ThreatClock & { isCompleted?: boolean },
  delta: number
): { clock: ThreatClock & { isCompleted: boolean }; justCompleted: boolean; clamped: boolean } {
  const prevFilled = clock.filledSegments;
  const newFilled = Math.max(0, Math.min(clock.totalSegments, prevFilled + delta));
  const isCompleted = newFilled === clock.totalSegments;
  const justCompleted = prevFilled < clock.totalSegments && isCompleted;
  const clamped = (delta > 0 && prevFilled === clock.totalSegments) || (delta < 0 && prevFilled === 0);

  return {
    clock: {
      ...clock,
      filledSegments: newFilled,
      isCompleted,
    },
    justCompleted,
    clamped,
  };
}

// ============================================================================
// 4. Lore & Clue Registry
// ============================================================================

export function createLoreEntry(
  content: string,
  status: 'SABIDO' | 'SEGREDO' = 'SEGREDO',
  sessionNumber = 1,
  associatedNodeIds: string[] = []
): LoreEntry & { associatedNodeIds: string[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Lore content cannot be empty or whitespace only.');
  }
  return {
    id: `lore-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content: trimmed,
    status,
    sessionNumber,
    associatedNodeIds: [...associatedNodeIds],
  };
}

export function toggleLoreEntryStatus(entry: LoreEntry): LoreEntry {
  return {
    ...entry,
    status: entry.status === 'SABIDO' ? 'SEGREDO' : 'SABIDO',
  };
}

export function filterLoreEntries(
  entries: LoreEntry[],
  statusFilter: 'TODOS' | 'SABIDO' | 'SEGREDO' = 'TODOS',
  searchQuery = ''
): LoreEntry[] {
  const query = searchQuery.toLowerCase().trim();
  return entries.filter((item) => {
    const matchesStatus = statusFilter === 'TODOS' || item.status === statusFilter;
    const matchesQuery = !query || item.content.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });
}

// ============================================================================
// 5. Timeline Chronometry
// ============================================================================

export function createTimelineMarker(
  sessionNumber: number,
  sessionText?: string,
  options: { inGameDate?: string; isCurrent?: boolean; label?: string } = {}
): TimelineMarker & { inGameDate?: string } {
  return {
    id: `tm-${Date.now()}-${sessionNumber}`,
    sessionNumber,
    sessionText: sessionText || `Sessão ${sessionNumber}`,
    isCurrent: options.isCurrent || false,
    label: options.label,
    inGameDate: options.inGameDate,
  };
}

export function switchActiveSession(
  timeline: TimelineMarker[],
  targetSessionNumber: number
): { timeline: TimelineMarker[]; activeSession: number } {
  const updated = timeline.map((marker) => ({
    ...marker,
    isCurrent: marker.sessionNumber === targetSessionNumber,
  }));
  return {
    timeline: updated,
    activeSession: targetSessionNumber,
  };
}

// ============================================================================
// 6. Interactive Atlas & Map Subsystem
// ============================================================================

export interface MapPin {
  id: string;
  mapId: string;
  xPercent: number; // 0.0 to 100.0
  yPercent: number; // 0.0 to 100.0
  title: string;
  category: 'location' | 'npc' | 'secret' | 'danger' | 'poi';
  color?: string;
  targetNodeId?: string;
}

export interface AtlasMap {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  pins: MapPin[];
}

export function calculateNormalizedPinCoords(
  pixelX: number,
  pixelY: number,
  mapWidth: number,
  mapHeight: number
): { xPercent: number; yPercent: number } {
  if (mapWidth <= 0 || mapHeight <= 0) {
    throw new Error('Map dimensions must be greater than zero');
  }
  const xPercent = Number(((pixelX / mapWidth) * 100).toFixed(2));
  const yPercent = Number(((pixelY / mapHeight) * 100).toFixed(2));
  return {
    xPercent: Math.max(0, Math.min(100, xPercent)),
    yPercent: Math.max(0, Math.min(100, yPercent)),
  };
}

export function createMapPin(
  mapId: string,
  xPercent: number,
  yPercent: number,
  title: string,
  category: MapPin['category'] = 'location',
  targetNodeId?: string
): MapPin {
  return {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mapId,
    xPercent: Math.max(0, Math.min(100, xPercent)),
    yPercent: Math.max(0, Math.min(100, yPercent)),
    title: title.trim() || 'Novo Ponto',
    category,
    targetNodeId,
  };
}

// ============================================================================
// 7. Storage, Serialization, & Schema Validation
// ============================================================================

export function validateCampaignSchema(raw: any): { valid: boolean; errors: string[]; data?: CampaignData } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Input is not a valid JSON object'] };
  }

  if (!raw.name || typeof raw.name !== 'string' || !raw.name.trim()) {
    errors.push('Missing or invalid campaign "name"');
  }
  if (!Array.isArray(raw.nodes)) {
    errors.push('"nodes" must be an array');
  }
  if (!Array.isArray(raw.edges)) {
    errors.push('"edges" must be an array');
  }
  if (!Array.isArray(raw.clocks)) {
    errors.push('"clocks" must be an array');
  }
  if (!Array.isArray(raw.lore)) {
    errors.push('"lore" must be an array');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const data: CampaignData = {
    id: raw.id || `camp-${Date.now()}`,
    name: raw.name.trim(),
    system: raw.system || 'Ordem Paranormal',
    currentSession: typeof raw.currentSession === 'number' ? raw.currentSession : 1,
    inGamePeriod: raw.inGamePeriod || 'Presente',
    description: raw.description || '',
    updatedAt: raw.updatedAt || new Date().toISOString(),
    nodes: raw.nodes || [],
    edges: raw.edges || [],
    clocks: raw.clocks || [],
    lore: raw.lore || [],
    timeline: raw.timeline || [{ id: 't-1', sessionNumber: 1, sessionText: 'Sessão 1', isCurrent: true }],
  };

  return { valid: true, errors: [], data };
}

export function migrateLegacyCampaign(raw: any): CampaignData {
  const validated = validateCampaignSchema(raw);
  if (validated.data) {
    // Fill in default node properties if missing
    validated.data.nodes = validated.data.nodes.map((node: any) => ({
      ...node,
      data: {
        id: node.id,
        type: node.data?.type || 'npc',
        title: node.data?.title || 'Entidade',
        subtitle: node.data?.subtitle || (node.data?.type || 'npc').toUpperCase(),
        description: node.data?.description || '',
        tags: Array.isArray(node.data?.tags) ? node.data.tags : [],
        isSecret: Boolean(node.data?.isSecret),
        revealed: node.data?.revealed ?? !node.data?.isSecret,
        color: node.data?.color || '#d4a359',
      },
    }));
    return validated.data;
  }
  throw new Error(`Failed to migrate legacy schema: ${validated.errors.join(', ')}`);
}

export function duplicateCampaign(source: CampaignData, newName?: string): CampaignData {
  const clone: CampaignData = JSON.parse(JSON.stringify(source));
  const newId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  clone.id = newId;
  clone.name = newName || `${source.name} (Cópia)`;
  clone.updatedAt = new Date().toISOString();
  return clone;
}

export function rotateBackupSnapshots(existingBackups: string[], newBackup: string, maxLimit = 5): string[] {
  const combined = [newBackup, ...existingBackups];
  return combined.slice(0, maxLimit);
}

// ============================================================================
// 8. Context Serializer & AI BYOK Engine
// ============================================================================

export function buildBoardContextPayload(campaign: CampaignData): string {
  const clocksStr = (campaign.clocks || [])
    .map(
      (c) =>
        `- ${c.title}: ${c.filledSegments}/${c.totalSegments} fatias${
          c.filledSegments === c.totalSegments ? ' (COMPLETO)' : ''
        }`
    )
    .join('\n');

  const nodes = campaign.nodes || [];
  const npcs = nodes
    .filter((n) => n.data?.type === 'npc')
    .map((n) => `- NPC: ${n.data.title} (${n.data.subtitle || 'Papel não especificado'}) - ${(n.data.description || '').slice(0, 100)}`)
    .slice(0, 8);

  const factions = nodes
    .filter((n) => n.data?.type === 'faction')
    .map((n) => `- Facção: ${n.data.title} - ${(n.data.description || '').slice(0, 100)}`)
    .slice(0, 4);

  const locations = nodes
    .filter((n) => n.data?.type === 'location')
    .map((n) => `- Local: ${n.data.title} - ${(n.data.description || '').slice(0, 100)}`)
    .slice(0, 6);

  const secrets = nodes
    .filter((n) => n.data?.type === 'secret' || n.data?.isSecret)
    .map((n) => `- Segredo Oculto: ${n.data.title} (${(n.data.description || '').slice(0, 100)})`)
    .slice(0, 5);

  const edgesStr = (campaign.edges || [])
    .map((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const targetNode = nodes.find((n) => n.id === e.target);
      const sourceTitle = sourceNode?.data?.title || e.source;
      const targetTitle = targetNode?.data?.title || e.target;
      return `- "${sourceTitle}" ${e.label || 'relaciona-se com'} "${targetTitle}"`;
    })
    .slice(0, 10)
    .join('\n');

  const recentLore = (campaign.lore || [])
    .slice(0, 6)
    .map((l) => `- [${l.status}] ${l.content.slice(0, 100)}`)
    .join('\n');

  return `
CAMPANHA: ${campaign.name} (Sistema: ${campaign.system}) | Sessão: ${campaign.currentSession} | Época: ${campaign.inGamePeriod}

RELÓGIOS DE AMEAÇA:
${clocksStr || '(Nenhum relógio ativo)'}

ENTIDADES PRINCIPAIS:
${[...npcs, ...factions, ...locations].join('\n') || '(Sem entidades)'}

RELAÇÕES CONHECIDAS:
${edgesStr || '(Sem ligações explícitas)'}

SEGREDOS OCULTOS (NÃO REVELADOS AOS JOGADORES):
${secrets.join('\n') || '(Sem segredos registados)'}

REGISTO RECENTE DE LORE:
${recentLore || '(Sem registos)'}
`.trim();
}

export interface AiHookOption {
  category: 'immediate_consequence' | 'alternative_clue' | 'threat_advancement';
  title: string;
  content: string;
  rawText: string;
}

export function parseAiRescueResponse(rawText: string): AiHookOption[] {
  const hooks: AiHookOption[] = [];

  const cat1Match = rawText.match(
    /(?:1\.\s*\[?(?:Consequência Imediata|Consequencia Imediata)\]?:?)([\s\S]*?)(?=(?:2\.\s*\[?|$))/i
  );
  const cat2Match = rawText.match(/(?:2\.\s*\[?(?:Pista Alternativa)\]?:?)([\s\S]*?)(?=(?:3\.\s*\[?|$))/i);
  const cat3Match = rawText.match(/(?:3\.\s*\[?(?:Avanço da Ameaça|Avanco da Ameaca)\]?:?)([\s\S]*?)$/i);

  if (cat1Match && cat2Match && cat3Match) {
    hooks.push({
      category: 'immediate_consequence',
      title: 'Consequência Imediata',
      content: cat1Match[1].trim(),
      rawText: cat1Match[0].trim(),
    });
    hooks.push({
      category: 'alternative_clue',
      title: 'Pista Alternativa',
      content: cat2Match[1].trim(),
      rawText: cat2Match[0].trim(),
    });
    hooks.push({
      category: 'threat_advancement',
      title: 'Avanço da Ameaça',
      content: cat3Match[1].trim(),
      rawText: cat3Match[0].trim(),
    });
  } else {
    // Fallback parser: lines starting with numbers
    const lines = rawText.split(/\n(?=\d+\.)/).filter((l) => l.trim().length > 0);
    const categories: AiHookOption['category'][] = [
      'immediate_consequence',
      'alternative_clue',
      'threat_advancement',
    ];
    const titles = ['Consequência Imediata', 'Pista Alternativa', 'Avanço da Ameaça'];

    for (let i = 0; i < 3; i++) {
      hooks.push({
        category: categories[i],
        title: titles[i],
        content: (lines[i] || `Opção de contingência ${i + 1}`)
          .replace(/^\d+\.\s*(\[[^\]]+\])?\s*:?\s*/, '')
          .trim(),
        rawText: lines[i] || '',
      });
    }
  }

  return hooks;
}

export class MockAiProvider {
  generateRescueHooks(prompt: string, contextPayload = ''): AiHookOption[] {
    const npcMatch = contextPayload.match(/NPC:\s*([^(\n]+)/);
    const npcName = npcMatch ? npcMatch[1].trim() : 'o contacto local';

    const secretMatch = contextPayload.match(/Segredo Oculto:\s*([^(\n]+)/);
    const secretName = secretMatch ? secretMatch[1].trim() : 'o segredo oculto';

    const clockMatch = contextPayload.match(/-\s*([^:\n]+):\s*\d+\/\d+/);
    const clockName = clockMatch ? clockMatch[1].trim() : 'os preparativos do culto';

    const defaultResponse = `
1. [Consequência Imediata]: A notícia do acontecimento espalha-se e "${npcName}" aproxima-se com perguntas suspeitas.
2. [Pista Alternativa]: No local do incidente é encontrado um documento rasgado que aponta diretamente para "${secretName}".
3. [Avanço da Ameaça]: A oposição toma nota da confusão gerada e acelera "${clockName}" em 1 passo.
`.trim();
    return parseAiRescueResponse(defaultResponse);
  }
}

