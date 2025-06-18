<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import axios from 'axios';
import { VNetworkGraph, defineConfigs } from "v-network-graph";
import { ForceLayout } from "v-network-graph/lib/force-layout";
import "v-network-graph/lib/style.css";

const mirnas = ref('');
const inputtedMirna = ref('');
const inputtedMirnaForDisplay = ref('');
const searchMode = ref('single');
const selectedHeuristics = ref([]);
const mergeStrategy = ref('UNION');
const heuristicStrategy = ref('UNION');
const heuristicStrategies = ['UNION', 'INTERSECTION', 'MAJORITY'];
const viewMode = ref('graph');
const showOutput = ref(false);
const isLoading = ref(false);
const graphDataKey = ref(0);
const isTitleCollapsed = ref(false);
const hasTitleBeenCollapsedByAction = ref(false);

const rawPredictions = ref({ names: [], predictions: [], geneCount: 0, pathwayCount: 0, durationInSeconds: 0 });
const graphData = ref({ nodes: [], relationships: [] });

const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['UNION', 'INTERSECTION', 'AT LEAST TWO'];;

const graphInstance = ref();
const edgeTooltipRef = ref();
const targetEdgeId = ref("");
const edgeTooltipOpacity = ref(0);
const edgeTooltipPos = ref({ left: "0px", top: "0px" });
const mousePosition = ref({ x: 0, y: 0 });

const searchErrorSnackbar = ref(false);
const searchErrorMessage = ref('');

const showPastSearchesDialog = ref(false);
const showHowToUseDialog = ref(false);
const pastSearchesList = ref([]);
const isLoadingPastSearches = ref(false);

const graphViewDisabled = computed(() => false);

const graphConfigs = defineConfigs({
  view: {
    layoutHandler: new ForceLayout({
      positionFixedByDrag: false, positionFixedByClickWithAltKey: true, simulationTime: 2500,
      createSimulation: (d3, nodes, edges) => {
        const forceLink = d3.forceLink(edges).id(d => d.id).distance(150).strength(0.5);
        return d3.forceSimulation(nodes)
            .force("edge", forceLink)
            .force("charge", d3.forceManyBody().strength(-1200))
            .force("center", d3.forceCenter().strength(0.02))
            .alphaMin(0.001);
      }
    }),
  },
  node: {
    selectable: true, hoverable: true,
    label: { visible: true, fontFamily: "Roboto, sans-serif", fontSize: 10, color: "#333333", margin: 4, direction: "south", text: "name" },
    normal: { radius: node => node.radius || 8, color: node => node.color || "#88c0d0" },
    hover: { radius: node => (node.radius || 8) + 2 },
    selected: { strokeWidth: 2, strokeColor: "#EAB308" }
  },
  edge: {
    selectable: true, hoverable: true,
    normal: { width: 2, color: "red" }, hover: { width: 3, color: "darkred" }, selected: { width: 3, color: "orange" },
    label: { visible: false }, gap: 15,
    marker: { target: { type: "arrow", width: 5, height: 5, margin: -2.5, units: "strokeWidth", color: "red" } }
  },
});

const processedGraphNodes = computed(() => {
  try {
    const nodesObject = {};
    if (graphData.value && graphData.value.nodes && Array.isArray(graphData.value.nodes)) {
      for (const node of graphData.value.nodes) {
        if (node && typeof node.id !== 'undefined' && node.id !== null) {
          const nodeId = String(node.id);
          nodesObject[nodeId] = {
            name: node.label || `Node ${nodeId}`,
            radius: (node.type === 'microRNA') ? 16 : ((node.type === 'Pathway') ? 10 : 8),
            color: (node.type === 'microRNA') ? '#03A9F4' : ((node.type === 'Pathway') ? '#FF5722' : '#4CAF50'),
            type: node.type || 'Unknown'
          };
        } else { console.warn("ProcessedGraphNodes: Skipping node due to missing id or node itself is null/undefined:", node); }
      }
    } else if (graphData.value && graphData.value.nodes) { console.warn("ProcessedGraphNodes: graphData.value.nodes is not an array. Value:", graphData.value.nodes); }
    return nodesObject;
  } catch (e) { console.error("Error inside processedGraphNodes computed property:", e); return {}; }
});

const processedGraphEdges = computed(() => {
  try {
    const edgesObject = {};
    if (graphData.value && graphData.value.relationships && Array.isArray(graphData.value.relationships)) {
      for (const rel of graphData.value.relationships) {
        if (rel && typeof rel.id !== 'undefined' && rel.id !== null &&
            typeof rel.source !== 'undefined' && rel.source !== null &&
            typeof rel.target !== 'undefined' && rel.target !== null) {
          const edgeId = String(rel.id);
          edgesObject[edgeId] = { source: String(rel.source), target: String(rel.target), name: rel.label || '' };
        } else { console.warn("ProcessedGraphEdges: Skipping edge due to missing id/source/target or edge itself is null/undefined:", rel); }
      }
    } else if (graphData.value && graphData.value.relationships) { console.warn("ProcessedGraphEdges: graphData.value.relationships is not an array. Value:", graphData.value.relationships); }
    return edgesObject;
  } catch (e) { console.error("Error inside processedGraphEdges computed property:", e); return {}; }
});

const hoveredEdgeDetails = computed(() => {
  if (!targetEdgeId.value || !processedGraphEdges.value[targetEdgeId.value]) { return null; }
  return processedGraphEdges.value[targetEdgeId.value];
});

watch(
    [edgeTooltipOpacity, targetEdgeId, () => edgeTooltipRef.value],
    () => {
      if (!edgeTooltipRef.value || edgeTooltipOpacity.value === 0 || !targetEdgeId.value) { return; }
      const tooltipHeight = edgeTooltipRef.value.offsetHeight;
      const top = mousePosition.value.y - tooltipHeight - 2;
      const left = mousePosition.value.x - 6;
      edgeTooltipPos.value = { left: left + "px", top: top + "px" };
    }, { flush: 'post' }
);

const graphEventHandlers = {
  "edge:pointerover": (event) => {
    const domPointerEvent = event.event;
    if (domPointerEvent && typeof domPointerEvent.clientX === 'number' && typeof domPointerEvent.clientY === 'number') {
      const graphContainerEl = graphInstance.value?.$el;
      if (graphContainerEl) {
        const containerRect = graphContainerEl.getBoundingClientRect();
        mousePosition.value = { x: domPointerEvent.clientX - containerRect.left, y: domPointerEvent.clientY - containerRect.top, };
      } else { mousePosition.value = { x: domPointerEvent.clientX, y: domPointerEvent.clientY }; }
    }
    targetEdgeId.value = event.edge || ""; edgeTooltipOpacity.value = 1;
  },
  "edge:pointerout": () => { edgeTooltipOpacity.value = 0; },
};

async function fetchGraphData(mirnaNamesToSearch, selectedToolsForGraph, mergeStrategyForGraph, heuristicStrategy) {
  if (!Array.isArray(mirnaNamesToSearch) || mirnaNamesToSearch.length === 0) {
    console.error('miRNA input must be a non-empty array.');
    graphData.value = { nodes: [], relationships: [] };
    return;
  }

  try {
    const params = new URLSearchParams();
    mirnaNamesToSearch.forEach(name => params.append('miRNANames', name));
    selectedToolsForGraph.forEach(tool => params.append('tools', tool));
    params.append('toolSelection', mergeStrategyForGraph);
    params.append('heuristic', heuristicStrategy);

    console.log(`[Graph Fetch] Requesting graph from backend with params: ${params.toString()}`);
    const response = await axios.get(`/api/graph?${params.toString()}`);

    // The backend now provides the data in the exact format we need
    graphData.value = response.data;
    console.log('[Graph Fetch] Received graphData from backend:', JSON.parse(JSON.stringify(graphData.value)));

  } catch (err) {
    console.error("Error fetching graph data from backend:", err);
    searchErrorMessage.value = 'Failed to load graph data from the server.';
    searchErrorSnackbar.value = true;
    graphData.value = { nodes: [], relationships: [] };
  }
}
onMounted(() => {
  console.log("Component mounted. Ready to fetch data from backend.");
});

onUnmounted(() => {
  console.log("Component unmounted.");
});

async function fetchTableData(mirnaNameList) {
  console.log(`[Table Fetch] Requesting predictions for: ${mirnaNameList.join(', ')}`);
  try {
    const params = new URLSearchParams();
    mirnaNameList.forEach(name => params.append('mirnaNames', name));
    selectedHeuristics.value.forEach(tool => params.append('tools', tool));
    params.append('toolSelection', mergeStrategy.value);
    params.append('heuristic', heuristicStrategy.value);

    const response = await axios.get(`/api/predictions?${params.toString()}`);

    rawPredictions.value = {
      names: response.data.mirna || [],
      predictions: response.data.predictions || [],
      geneCount: response.data.geneCount || 0,
      pathwayCount: response.data.pathwayCount || 0,
      durationInSeconds: response.data.searchTime || '0 ns'
    };
    console.log('[Table Fetch] rawPredictions.value (from backend):', JSON.parse(JSON.stringify(rawPredictions.value)));
  } catch (error) {
    console.error(`[Table Fetch] Error fetching table predictions for ${mirnaNameList.join(', ')}:`, error);
    rawPredictions.value = {
      names: [],
      predictions: [],
      geneCount: 0,
      pathwayCount: 0,
      durationInSeconds: '0 ns'
    };
  }
}

const filteredPredictions = computed(() => {
  if (!rawPredictions.value || !rawPredictions.value.predictions || rawPredictions.value.predictions.length === 0) {
    return [];
  }
  return rawPredictions.value.predictions.map(pred => ({
    gene: pred.gene,
    tools: pred.tools,
    pathways: pred.pathways.length > 0 ? pred.pathways : ["N/A"],
    mirnasInvolved: rawPredictions.value.names,
    connections: pred.connections || []
  }));
});

const networkStatisticsText = computed(() => {
  if (!showOutput.value || isLoading.value) return "";

  const { geneCount, pathwayCount, durationInSeconds } = rawPredictions.value;
  const mirnaCount = inputtedMirnaForDisplay.value
      ? inputtedMirnaForDisplay.value.split(",").map(m => m.trim()).filter(Boolean).length
      : 0;

  let stats = `Found: ${geneCount || 0} genes, ${pathwayCount || 0} pathways for ${mirnaCount} miRNA(s). Database search took ${durationInSeconds}.`;

  if (viewMode.value === 'graph' && searchMode.value === 'single' && mirnaCount === 1) {
    const nodeCount = Object.keys(processedGraphNodes.value).length;
    const edgeCount = Object.keys(processedGraphEdges.value).length;
    stats = `Graph: ${nodeCount} nodes, ${edgeCount} edges. ${stats}`;
  }
  return stats;
});

const toggleTitleCollapse = () => {
  isTitleCollapsed.value = !isTitleCollapsed.value;
  hasTitleBeenCollapsedByAction.value = true;
};

const toggleSearchModeAndCollapseTitle = () => {
  searchMode.value = searchMode.value === 'single' ? 'multiple' : 'single';
  if (!hasTitleBeenCollapsedByAction.value) {
    isTitleCollapsed.value = true;
  }
  mirnas.value = '';
  showOutput.value = false;
  rawPredictions.value = { names: [], predictions: [], geneCount: 0, pathwayCount: 0, durationInSeconds: 0 };
  graphData.value = { nodes: [], relationships: [] };
};

const submitSearchAndCollapseTitle = async () => {
  isLoading.value = true;
  showOutput.value = false;
  rawPredictions.value = { names: [], predictions: [], geneCount: 0, pathwayCount: 0, durationInSeconds: 0 };
  graphData.value = { nodes: [], relationships: [] };

  const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (searchMode.value === 'single' && mirnaList.length !== 1) {
    searchErrorMessage.value = 'Please enter exactly one miRNA for Single Search.';
    searchErrorSnackbar.value = true;
    isLoading.value = false;
    return;
  }
  if (searchMode.value === 'multiple' && mirnaList.length < 2) {
    searchErrorMessage.value = 'Please enter at least two miRNAs for Multiple Search.';
    searchErrorSnackbar.value = true;
    isLoading.value = false;
    return;
  }

  inputtedMirna.value = mirnas.value;
  inputtedMirnaForDisplay.value = mirnaList.join(', ');

  if (!hasTitleBeenCollapsedByAction.value) {
    isTitleCollapsed.value = true;
  }

  try {
    await fetchTableData(mirnaList);
    await fetchGraphData(mirnaList, selectedHeuristics.value, mergeStrategy.value, heuristicStrategy.value);
    showOutput.value = true;
  } catch (error) {
    console.error("Error during search submission:", error);
    searchErrorMessage.value = 'An error occurred during data analysis. Please try again.';
    searchErrorSnackbar.value = true;
  } finally {
    isLoading.value = false;
    graphDataKey.value++;
  }
};

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph';
};

const openPastSearchesDialog = async () => {
  isLoadingPastSearches.value = true;
  showPastSearchesDialog.value = true;
  try {
    const response = await axios.get('/api/pastSearches');
    pastSearchesList.value = response.data;
  } catch (error) {
    console.error("Error fetching past searches:", error);
    pastSearchesList.value = [];
  } finally {
    isLoadingPastSearches.value = false;
  }
};

const selectPastSearch = (searchItem) => {
  mirnas.value = searchItem.mirnaNames.join(', ');
  selectedHeuristics.value = [...searchItem.tools];
  mergeStrategy.value = searchItem.toolSelection;
  heuristicStrategy.value = searchItem.heuristic;

  if (searchItem.mirnaNames.length > 1) {
    searchMode.value = 'multiple';
  } else {
    searchMode.value = 'single';
  }

  showPastSearchesDialog.value = false;
  submitSearchAndCollapseTitle();
};

const exportTableData = () => {
  if (!filteredPredictions.value || filteredPredictions.value.length === 0) {
    console.warn("No data to export.");
    return;
  }
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "miRNA(s),Tool(s),Tool-Score(s),Gene,Pathway(s)\n";

  filteredPredictions.value.forEach(row => {
    const mirnasCsv = Array.isArray(row.mirnasInvolved)
        ? `"${row.mirnasInvolved.join(';')}"`
        : `"${inputtedMirnaForDisplay.value}"`;
    const tools = Array.isArray(row.tools)
        ? `"${row.tools.join(';')}"`
        : "";
    const gene = `"${row.gene}"`;
    const pathways = Array.isArray(row.pathways)
        ? `"${row.pathways.join(';')}"`
        : "";
    const scoreDetails = (row.connections || [])
        .map(conn => `${conn.tool} (${conn.mirna}): ${conn.quality ?? 'N/A'}`)
        .join('; ');
    const scores = `"${scoreDetails}"`;
    csvContent += `${mirnasCsv},${tools},${scores},${gene},${pathways}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "miRNA_predictions.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<template>
  <v-container fluid class="pa-10 bio-bg text-grey-darken-4 d-flex flex-column"
               style="min-height: 100vh; position: relative;">
    <div class="dna-bg-overlay"></div>

    <div style="position: absolute; top: 1.5rem; right: 1.5rem; z-index: 10;">
      <v-btn variant="text" @click="showHowToUseDialog = true" class="text-grey-darken-1 text-capitalize">
        How to use
        <v-icon end>mdi-help-circle-outline</v-icon>
      </v-btn>
    </div>

    <div class="text-center position-relative z-index-1"
         :class="{ 'mb-8': !isTitleCollapsed, 'mb-4': isTitleCollapsed }" @click="toggleTitleCollapse"
         :style="isTitleCollapsed ? 'cursor: pointer;' : ''">
      <template v-if="!isTitleCollapsed">
        <v-icon size="64" color="green darken-2">mdi-dna</v-icon>
        <h1 class="text-h4 font-weight-bold mt-2">miRNA Target Gene & Pathway Analyzer</h1>
        <h2 class="subtitle-1 text-grey mt-1 mb-4">
          Analyze miRNA interactions, predicted target genes, and affected pathways
        </h2>
      </template>
      <template v-else>
        <div class="d-flex align-center justify-center pa-2"
             style="background-color: rgba(255,255,255,0.1); border-radius: 8px;">
          <v-icon size="28" color="green darken-2" class="mr-3">mdi-dna</v-icon>
          <h1 class="text-h5 font-weight-bold">MiRNA Target Gene & Pathway Analyzer</h1>
        </div>
      </template>
    </div>
    <div class="d-flex flex-grow-1 align-center z-index-1">
      <v-row justify="center" class="position-relative w-100">
        <v-col cols="12" md="6" lg="5">
          <v-card class="pa-6 rounded-lg elevation-10 d-flex flex-column justify-center" style="min-height:450px">
            <v-form @submit.prevent="submitSearchAndCollapseTitle">
              <div class="text-center mb-4 d-flex justify-space-between align-center">
                <h3 class="text-h6 font-weight-medium text-grey-darken-2">
                  {{ searchMode === 'single' ? 'Single miRNA Search' : 'Multiple miRNAs Search' }}
                </h3>
                <v-chip @click="toggleSearchModeAndCollapseTitle" color="green-darken-1" variant="outlined" label small
                        class="cursor-pointer" style="user-select: none;">
                  <v-icon left small class="mr-1">mdi-swap-horizontal-bold</v-icon> Switch to {{ searchMode === 'single'
                    ? 'Multiple miRNAs' : 'Single miRNA' }} Mode
                </v-chip>
              </div>
              <v-textarea v-model="mirnas"
                          :label="searchMode === 'single' ? 'Enter a single miRNA' : 'Enter miRNA(s) (comma or new line separated)'"
                          auto-grow rows="1" outlined class="mb-4">
              </v-textarea>
              <v-select v-model="selectedHeuristics" :items="heuristics" label="Select Tools" multiple chips outlined
                        class="mb-2 mt-4">
              </v-select>
              <v-select v-model="mergeStrategy" :items="strategies" label="Select Tool Merge Strategy" outlined chips
                        class="mb-4 mt-4">
              </v-select>
              <v-select v-if="searchMode === 'multiple'" v-model="heuristicStrategy" :items="heuristicStrategies"
                        label="Select Multi-miRNA Heuristic Strategy" outlined chips class="mb-4 mt-4">
              </v-select>
              <div class="text-center">
                <v-btn type="submit" color="green darken-1" dark :loading="isLoading" class="mr-2">
                  <v-icon left>mdi-magnify</v-icon> Analyze
                </v-btn>
                <v-tooltip location="top" text="View past searches">
                  <template #activator="{ props: tooltipProps }">
                    <v-btn v-bind="tooltipProps" icon variant="text" color="blue-grey-lighten-1"
                           @click="openPastSearchesDialog" aria-label="Show past searches">
                      <v-icon>mdi-history</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
              </div>
            </v-form>
          </v-card>
        </v-col>
        <v-col cols="12" md="6" class="d-flex flex-column align-center justify-center">
          <div v-if="!showOutput && !isLoading" class="text-center">
            <v-icon size="120" color="grey lighten-1">mdi-graph-outline</v-icon>
            <p class="mt-2 text-subtitle-2 text-grey">Your network or table will be shown here.</p>
          </div>
          <div v-if="isLoading && !showOutput"
               class="text-center fill-height d-flex flex-column justify-center align-center">
            <v-progress-circular indeterminate color="green darken-1" size="64"></v-progress-circular>
            <p class="mt-4 text-subtitle-2 text-grey">Loading data for {{ inputtedMirnaForDisplay }}...</p>
          </div>
          <div v-if="showOutput && !isLoading" class="w-100">
            <div class="d-flex justify-end align-center mb-2">
              <v-btn color="green darken-1" @click="toggleViewMode" small dark :disabled="graphViewDisabled"
                     class="mr-2">
                <v-icon left>mdi-swap-horizontal</v-icon>
                {{ viewMode === 'graph' ? 'Switch to Table View' : 'Switch to Graph View' }}
              </v-btn>
              <v-tooltip location="top" text="Export current table data as CSV">
                <template #activator="{ props: tooltipProps }">
                  <v-btn v-if="viewMode === 'table' && filteredPredictions.length > 0" v-bind="tooltipProps" icon
                         variant="outlined" color="blue-darken-2" size="small" @click="exportTableData"
                         aria-label="Export table data"> <v-icon>mdi-file-export-outline</v-icon> </v-btn>
                </template>
              </v-tooltip>
            </div>
            <div v-if="viewMode === 'graph'" id="network-visualization-container-wrapper"
                 class="pa-4 elevation-2 rounded-lg"
                 style="width: 100%; height: 400px; background-color: #f0f2f5; border: 1px solid #ccc; overflow: hidden; position: relative;">
              <v-tooltip location="left" max-width="300px">
                <template #activator="{ props: tooltipProps }">
                  <v-btn v-bind="tooltipProps" icon variant="text" size="x-small"
                         style="position: absolute; top: 8px; right: 8px; z-index: 10;" aria-label="Graph Interaction Help"
                         color="grey-darken-1">
                    <v-icon>mdi-help-circle-outline</v-icon>
                  </v-btn>
                </template>
                <span>
                  Drag nodes to rearrange. Scroll to zoom. Alt+Click a node to fix its position. Hover over edges to see
                  relationship types.
                </span>
              </v-tooltip>
              <template
                  v-if="processedGraphNodes && typeof processedGraphNodes === 'object' && Object.keys(processedGraphNodes).length > 0 && !isLoading">
                <v-network-graph ref="graphInstance" :key="graphDataKey" :nodes="processedGraphNodes"
                                 :edges="processedGraphEdges" :configs="graphConfigs" :event-handlers="graphEventHandlers"
                                 class="graph-bg" style="width: 100%; height: 100%;" />
                <div ref="edgeTooltipRef" class="edge-tooltip"
                     :style="{ ...edgeTooltipPos, opacity: edgeTooltipOpacity }">
                  <div v-if="hoveredEdgeDetails"> {{ hoveredEdgeDetails.name }} </div>
                </div>
              </template>
              <div v-else-if="isLoading" class="d-flex justify-center align-center fill-height">
                <v-progress-circular indeterminate color="green darken-1" size="50"></v-progress-circular>
                <p class="mt-2 text-subtitle-2 text-grey">Loading graph...</p>
              </div>
              <p v-else
                 class="text-center text-grey-darken-2 mt-10 d-flex flex-column justify-center align-center fill-height">
                <span>No graph data found for "{{ inputtedMirnaForDisplay }}" from Neo4j.</span>
                <span class="text-caption mt-1">Try searching for a specific miRNA (e.g., "mmu-let-7g"). Or check
                  selected
                  tools/strategy.</span>
              </p>
            </div>
            <div v-else-if="viewMode === 'table'" class="pa-4 elevation-2 rounded-lg"
                 style="width: 100%; height: 400px; background-color: #ffffff; border: 1px solid #ccc; overflow-y: auto;">
              <div v-if="filteredPredictions.length" style="height: 100%; overflow-y: auto;"> <v-table dense>
                <thead>
                <tr>
                  <th>miRNA(s)</th>
                  <th>Tool(s)</th>
                  <th>Score/Experiment(s)</th>
                  <th>Gene</th>
                  <th>Pathway(s)</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(prediction, index) in filteredPredictions" :key="`${prediction.gene}-${index}`">
                  <td>
                    <v-chip
                        v-for="mir in [...new Set(prediction.connections.map(conn => conn.mirna))]"
                        :key="mir"
                        small
                        class="ma-1"
                    >
                      {{ mir }}
                    </v-chip>
                  </td>
                  <td>
                    <v-chip v-for="(tool, i) in prediction.tools" :key="i" class="ma-1" small>{{ tool }}</v-chip>
                  </td>
                  <td>
                    <div v-if="prediction.connections && prediction.connections.length > 0">
                      <div v-for="(conn, i) in prediction.connections" :key="i" class="mb-1">
                        <strong>{{ conn.tool }}</strong> ({{ conn.mirna }}):
                        <span>{{ conn.quality !== null && conn.quality !== undefined ? conn.quality : 'N/A'
                          }}</span>
                      </div>
                    </div>
                    <span v-else>N/A</span>
                  </td>
                  <td>{{ prediction.gene }}</td>
                  <td>
                    <v-chip v-for="(path, j) in prediction.pathways" :key="j" class="ma-1" small>{{ path }}</v-chip>
                  </td>
                </tr>
                </tbody>
              </v-table>
              </div>
              <div v-else class="mt-6 text-center text-grey">
                <p class="text-subtitle-1">No table predictions found for "{{ inputtedMirnaForDisplay }}" based on the
                  selected criteria.</p>
              </div>
            </div>
            <div v-if="networkStatisticsText" class="mt-3 text-caption text-grey-darken-1 text-center">
              {{ networkStatisticsText }}
            </div>
          </div>
        </v-col>
      </v-row>
    </div>

    <v-dialog v-model="showHowToUseDialog" max-width="700px">
      <v-card class="rounded-lg">
        <v-card-title class="d-flex justify-space-between align-center text-green-darken-2">
          <span>How to use the Analyzer</span>
          <v-btn icon variant="text" @click="showHowToUseDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text style="max-height: 60vh; overflow-y: auto;" class="py-4 px-6 text-grey-darken-3">
          <h4 class="text-h6 mt-2 mb-2 font-weight-bold">1. Select Search Mode</h4>
          <p class="body-1">You can switch between searching for a single miRNA or multiple miRNAs at once using the
            "Switch Mode" button.</p>

          <h4 class="text-h6 mt-4 mb-2 font-weight-bold">2. Enter miRNA(s)</h4>
          <ul class="pl-5">
            <li><strong>Single miRNA Search:</strong> Enter one full miRNA name (e.g., mmu-let-7a-5p).</li>
            <li><strong>Multiple miRNAs Search:</strong> Enter multiple miRNA names, separated by commas or new lines.
            </li>
          </ul>

          <h4 class="text-h6 mt-4 mb-2 font-weight-bold">3. Select Tools</h4>
          <p class="body-1">Choose one or more prediction databases to query. It's recommended to select at least two
            for more robust results.</p>

          <h4 class="text-h6 mt-4 mb-2 font-weight-bold">4. Select Tool Merge Strategy</h4>
          <ul class="pl-5">
            <li><strong>UNION:</strong> Shows target genes predicted by <strong>any</strong> of your selected tools.
            </li>
            <li><strong>INTERSECTION:</strong> Shows target genes predicted by <strong>all</strong> of your selected
              tools.</li>
            <li><strong>AT LEAST TWO:</strong> Shows target genes predicted by <strong>at least two</strong> of your
              selected tools.</li>
          </ul>

          <h4 class="text-h6 mt-4 mb-2 font-weight-bold">5. Select Multi-miRNA Heuristic Strategy (Multiple miRNAs Mode
            only)</h4>
          <p class="body-1">This determines how results are combined when you search for multiple miRNAs.</p>
          <ul class="pl-5">
            <li><strong>UNION:</strong> A gene is considered a target if <strong>any</strong> of the searched miRNAs
              predict it.</li>
            <li><strong>INTERSECTION:</strong> A gene is considered a target only if <strong>all</strong> of the
              searched miRNAs predict it.</li>
            <li><strong>MAJORITY:</strong> A gene is considered a target if more than half (>50%) of the searched miRNAs
              predict it.</li>
          </ul>

          <h4 class="text-h6 mt-4 mb-2 font-weight-bold">6. Analyze & View Results</h4>
          <p class="body-1">Click "Analyze" to see the results. You can toggle between a visual graph network and a data
            table. The table data can be exported to a CSV file.</p>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-grey-darken-1" variant="text" @click="showHowToUseDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showPastSearchesDialog" max-width="700px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="d-flex justify-space-between align-center text-green-darken-2">
          <span>Past Searches</span>
          <v-btn icon variant="text" @click="showPastSearchesDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text style="min-height: 300px; max-height: 60vh; overflow-y: auto;">
          <div v-if="isLoadingPastSearches" class="text-center pa-10">
            <v-progress-circular indeterminate color="green-darken-1" size="48"></v-progress-circular>
            <p class="mt-3 text-grey">Loading past searches...</p>
          </div>
          <div v-else-if="!pastSearchesList || pastSearchesList.length === 0" class="text-center pa-10 text-grey">
            <v-icon size="48" class="mb-2">mdi-history</v-icon>
            <p>No past searches found.</p>
          </div>
          <v-list v-else lines="three" select-strategy="classic">
            <v-list-item v-for="(search, index) in pastSearchesList" :key="index" @click="selectPastSearch(search)"
                         class="mb-2 elevation-1 rounded" style="border-left: 4px solid #4CAF50;">
              <v-list-item-title class="font-weight-medium text-grey-darken-3">
                {{ search.mirnaNames.join(", ") }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey-darken-1 mt-1">
                <strong>Tools:</strong> {{ search.tools.join(", ") || 'Any' }} <br>
                <strong>Tool Strategy:</strong> {{ search.toolSelection }} <br>
                <span v-if="search.mirnaNames.length > 1">
                  <strong>Multi-miRNA Heuristic:</strong> {{ search.heuristic }}
                </span>
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-icon color="green-darken-1">mdi-replay</v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-grey-darken-1" variant="text" @click="showPastSearchesDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="searchErrorSnackbar" color="red darken-1" timeout="4000" elevation="6" location="top">
      {{ searchErrorMessage }}
      <template #actions>
        <v-btn variant="text" @click="searchErrorSnackbar = false" color="white">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.fill-height {
  height: 100%;
}

.bio-bg {
  background: linear-gradient(135deg, #ecfafc, #f3faf2);
  position: relative;
  overflow: hidden;
}

.dna-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  background-repeat: repeat;
  background-position: 0 0;
  background-size: 300px 800px;
  opacity: 0.07;
  animation: scrollBackground 60s linear infinite;
  background-image: url("data:image/svg+xml,%3Csvg width='300' height='800' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2388c0d0' stroke-width='3'%3E%3Cpath d='M150 0 C280 50, 20 150, 150 200 C280 250, 20 350, 150 400 C280 450, 20 550, 150 600 C280 650, 20 750, 150 800'/%3E%3C/g%3E%3Cg fill='%23cba8ff'%3E%3Ccircle cx='150' cy='50' r='4'/%3E%3Ccircle cx='150' cy='150' r='4'/%3E%3Ccircle cx='150' cy='250' r='4'/%3E%3Ccircle cx='150' cy='350' r='4'/%3E%3Ccircle cx='150' cy='450' r='4'/%3E%3Ccircle cx='150' cy='550' r='4'/%3E%3Ccircle cx='150' cy='650' r='4'/%3E%3Ccircle cx='150' cy='750' r='4'/%3E%3C/g%3E%3C/svg%3E");
}

@keyframes scrollBackground {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: 0 800px;
  }
}

.z-index-1 {
  z-index: 1;
  position: relative;
}

.w-100 {
  width: 100%;
}

.edge-tooltip {
  top: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  padding: 6px 10px;
  font-size: 12px;
  background-color: #fff0bd;
  border: 1px solid #ffb950;
  border-radius: 4px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2);
  transition: opacity 0.2s ease-out;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
}

.cursor-pointer {
  cursor: pointer;
}
</style>