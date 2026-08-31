<!-- File: src/lib/components/canvas/CanvasView.svelte -->
<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import CanvasContent from './CanvasContent.svelte';
</script>

<SvelteFlowProvider>
  <CanvasContent />
</SvelteFlowProvider>
