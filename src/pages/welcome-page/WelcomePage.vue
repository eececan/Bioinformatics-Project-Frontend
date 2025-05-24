<template>
  <v-container
      fluid
      class="pa-10 bio-bg text-grey-darken-4 d-flex flex-column"
      style="min-height: 100vh; position: relative;"
  >
    <div class="dna-bg-overlay"></div>

    <div
        class="text-center position-relative z-index-1"
        :class="{ 'mb-8': !isTitleCollapsed, 'mb-4': isTitleCollapsed }"
        @click="toggleTitleCollapse"
        :style="isTitleCollapsed ? 'cursor: pointer;' : ''"
    >
      <template v-if="!isTitleCollapsed">
        <v-icon size="64" color="green darken-2">mdi-dna</v-icon>
        <h1 class="text-h4 font-weight-bold mt-2">miRNA Target Gene & Pathway Analyzer</h1>
        <h2 class="subtitle-1 text-grey mt-1 mb-4">
          Analyze miRNA interactions, predicted target genes, and affected pathways
        </h2>
      </template>
      <template v-else>
        <div class="d-flex align-center justify-center pa-2" style="background-color: rgba(255,255,255,0.1); border-radius: 8px;">
          <v-icon size="28" color="green darken-2" class="mr-3">mdi-dna</v-icon>
          <h1 class="text-h5 font-weight-bold">MiRNA Target Gene & Pathway Analyzer</h1>
        </div>
      </template>
    </div>
    <div class="d-flex flex-grow-1 align-center z-index-1">
      <v-row justify="center" class="position-relative w-100">
        <v-col cols="12" md="6" lg="5">
          <v-card
              class="pa-6 rounded-lg elevation-10 d-flex flex-column justify-center"
              style="min-height:450px"
          >
            <v-form @submit.prevent="submitSearchAndCollapseTitle">
              <div class="text-center mb-4 d-flex justify-space-between align-center">
                <h3 class="text-h6 font-weight-medium text-grey-darken-2">
                  {{ searchMode === 'single' ? 'Single miRNA Search' : 'Multiple miRNAs Search' }}
                </h3>
                <v-tooltip location="bottom">
                  <template #activator="{ props: tooltipProps }">
                    <v-chip
                        v-bind="tooltipProps" @click="toggleSearchModeAndCollapseTitle" color="green-darken-1"
                        variant="outlined" label small class="cursor-pointer" style="user-select: none;"
                        aria-label="Switch search mode"
                    >
                      <v-icon left small class="mr-1">mdi-swap-horizontal-bold</v-icon> Switch
                    </v-chip>
                  </template>
                  <span>Switch to {{ searchMode === 'single' ? 'Multiple miRNAs' : 'Single miRNA' }} Search Mode</span>
                </v-tooltip>
              </div>

              <v-textarea
                  v-model="mirnas" :label="searchMode === 'single' ? 'Enter a single miRNA' : 'Enter miRNA(s)'"
                  auto-grow rows="1" outlined class="mb-4" persistent-hint hint=" "
              >
                <template #append-inner>
                  <v-tooltip location="top">
                    <template #activator="{ props }"> <v-icon v-bind="props" small class="ml-1">mdi-information-outline</v-icon> </template>
                    <span v-if="searchMode === 'single'">e.g., mmu-let-7a-5p</span> <span v-else>Separate with commas or newlines</span>
                  </v-tooltip>
                </template>
              </v-textarea>

              <v-select
                  v-model="selectedHeuristics" :items="heuristics" label="Select Tools"
                  multiple chips outlined class="mb-2 mt-4"
              >
                <template #append>
                  <v-tooltip text="Select prediction tools. Affects graph & table.">
                    <template #activator="{ props }"> <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon> </template>
                  </v-tooltip>
                </template>
              </v-select>

              <v-select
                  v-model="mergeStrategy" :items="strategies" label="Select Tool Merge Strategy"
                  outlined chips class="mb-4 mt-4"
              >
                <template #append>
                  <v-tooltip text="'UNION' = targets from any selected tool, 'INTERSECTION' = targets common to ALL selected tools, 'AT_LEAST_TWO' = targets predicted by >= 2 selected tools. Affects graph & table.">
                    <template #activator="{ props }"> <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon> </template>
                  </v-tooltip>
                </template>
              </v-select>

              <v-select
                  v-if="searchMode === 'multiple'" v-model="heuristicStrategy" :items="heuristicStrategies"
                  label="Select Multi-miRNA Heuristic Strategy" outlined chips class="mb-4 mt-4"
              >
                <template #append>
                  <v-tooltip text="'UNION' = targets if any miRNA predicts them, 'INTERSECTION' = targets ONLY if ALL miRNAs predict them, 'MAJORITY' = targets if >50% of miRNAs predict them. (Affects Table View for multiple miRNAs)">
                    <template #activator="{ props }"> <v-icon v-bind="props" small class="ml-2">mdi-account-group-outline</v-icon> </template>
                  </v-tooltip>
                </template>
              </v-select>

              <div class="text-center">
                <v-btn type="submit" color="green darken-1" dark :loading="isLoading" class="mr-2">
                  <v-icon left>mdi-magnify</v-icon> Analyze
                </v-btn>
                <v-tooltip location="top" text="View past searches">
                  <template #activator="{ props: tooltipProps }">
                    <v-btn v-bind="tooltipProps" icon variant="text" color="blue-grey-lighten-1" @click="showPastSearches" aria-label="Show past searches">
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
          <div v-if="isLoading && !showOutput" class="text-center fill-height d-flex flex-column justify-center align-center">
            <v-progress-circular indeterminate color="green darken-1" size="64"></v-progress-circular>
            <p class="mt-4 text-subtitle-2 text-grey">Loading data for {{ inputtedMirnaForDisplay }}...</p>
          </div>

          <div v-if="showOutput && !isLoading" class="w-100">
            <div class="d-flex justify-end align-center mb-2">
              <v-btn
                  color="green darken-1" @click="toggleViewMode" small dark
                  :disabled="graphViewDisabled" class="mr-2"
              >
                <v-icon left>mdi-swap-horizontal</v-icon>
                {{ viewMode === 'graph' ? 'Switch to Table View' : 'Switch to Graph View' }}
              </v-btn>

              <v-tooltip location="top" text="Export current table data as CSV">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                      v-if="viewMode === 'table' && filteredPredictions.length > 0"
                      v-bind="tooltipProps" icon variant="outlined" color="blue-darken-2"
                      size="small" @click="exportTableData" aria-label="Export table data"
                  > <v-icon>mdi-file-export-outline</v-icon> </v-btn>
                </template>
              </v-tooltip>
            </div>


            <div
                v-if="viewMode === 'graph'"
                id="network-visualization-container-wrapper"
                class="pa-4 elevation-2 rounded-lg"
                style="width: 100%; height: 400px; background-color: #f0f2f5; border: 1px solid #ccc; overflow: hidden; position: relative;"
            >
              <v-tooltip location="left" max-width="300px">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                      v-bind="tooltipProps"
                      icon variant="text" size="x-small"
                      style="position: absolute; top: 8px; right: 8px; z-index: 10;"
                      aria-label="Graph Interaction Help"
                      color="grey-darken-1"
                  >
                    <v-icon>mdi-help-circle-outline</v-icon>
                  </v-btn>
                </template>
                <span>
                    Drag nodes to rearrange. Scroll to zoom. Alt+Click a node to fix its position. Hover over edges to see relationship types.
                </span>
              </v-tooltip>
              <template v-if="processedGraphNodes && typeof processedGraphNodes === 'object' && Object.keys(processedGraphNodes).length > 0 && !isLoading">
                <v-network-graph
                    ref="graphInstance" :key="graphDataKey" :nodes="processedGraphNodes" :edges="processedGraphEdges"
                    :configs="graphConfigs" :event-handlers="graphEventHandlers" class="graph-bg" style="width: 100%; height: 100%;"
                />
                <div ref="edgeTooltipRef" class="edge-tooltip" :style="{ ...edgeTooltipPos, opacity: edgeTooltipOpacity }">
                  <div v-if="hoveredEdgeDetails"> {{ hoveredEdgeDetails.name }} </div>
                </div>
              </template>
              <div v-else-if="isLoading" class="d-flex justify-center align-center fill-height">
                <v-progress-circular indeterminate color="green darken-1" size="50"></v-progress-circular>
                <p class="mt-2 text-subtitle-2 text-grey">Loading graph...</p>
              </div>
              <p v-else class="text-center text-grey-darken-2 mt-10 d-flex flex-column justify-center align-center fill-height">
                <span>No graph data found for "{{ inputtedMirnaForDisplay }}" from Neo4j.</span>
                <span class="text-caption mt-1">Try searching for a specific miRNA (e.g., "mmu-let-7a-5p"). Or check selected tools/strategy.</span>
              </p>
            </div>

            <div
                v-else-if="viewMode === 'table'"
                class="pa-4 elevation-2 rounded-lg"
                style="width: 100%; height: 400px; background-color: #ffffff; border: 1px solid #ccc; overflow-y: auto;"
            >
              <v-tooltip location="left" max-width="300px" v-if="false"> <template #activator="{ props: tooltipProps }">
                <v-btn
                    v-bind="tooltipProps"
                    icon variant="text" size="x-small"
                    style="position: absolute; top: 8px; right: 8px; z-index: 10;"
                    aria-label="Table View Help"
                    color="grey-darken-1"
                >
                  <v-icon>mdi-help-circle-outline</v-icon>
                </v-btn>
              </template>
                <span>This table shows predicted gene targets and their associated pathways based on your selections. You can filter by tools and merge strategies.</span>
              </v-tooltip>
              <div v-if="filteredPredictions.length" style="height: 100%; overflow-y: auto;"> <v-table dense>
                <thead> <tr> <th>miRNA(s)</th> <th>Tool(s)</th> <th>Gene</th> <th>Pathway(s)</th> </tr> </thead>
                <tbody>
                <tr v-for="(prediction, index) in filteredPredictions" :key="`${prediction.gene}-${index}`">
                  <td>
                    <v-chip v-if="Array.isArray(prediction.mirnasInvolved)" v-for="mir in prediction.mirnasInvolved" :key="mir" small class="ma-1">{{ mir }}</v-chip>
                    <span v-else>{{ prediction.mirna || inputtedMirnaForDisplay }}</span>
                  </td>
                  <td> <v-chip v-for="(tool, i) in prediction.tools" :key="i" class="ma-1" small>{{ tool }}</v-chip> </td>
                  <td>{{ prediction.gene }}</td>
                  <td> <v-chip v-for="(path, j) in prediction.pathways" :key="j" class="ma-1" small>{{ path }}</v-chip> </td>
                </tr>
                </tbody>
              </v-table>
              </div>
              <div v-else class="mt-6 text-center text-grey">
                <p class="text-subtitle-1">No table predictions found for "{{ inputtedMirnaForDisplay }}" based on the selected criteria.</p>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import { VNetworkGraph, defineConfigs } from "v-network-graph";
import { ForceLayout } from "v-network-graph/lib/force-layout";
import "v-network-graph/lib/style.css";

// --- Page State ---
const mirnas = ref('');
const inputtedMirna = ref(''); // Stores the raw input for display purposes
const inputtedMirnaForDisplay = ref(''); // Stores the processed input for display

const searchMode = ref('single');

const selectedHeuristics = ref([]); // Corresponds to 'tools' in backend
const mergeStrategy = ref('UNION'); // Corresponds to 'toolSelection' in backend

const heuristicStrategy = ref('UNION'); // Corresponds to 'heuristic' in backend
const heuristicStrategies = ['UNION', 'INTERSECTION', 'MAJORITY']; // Backend values

const viewMode = ref('graph');
const showOutput = ref(false);
const isLoading = ref(false);
const graphDataKey = ref(0);

const isTitleCollapsed = ref(false);
const hasTitleBeenCollapsedByAction = ref(false);

// --- Data ---
// CORRECTED LINE: Changed 'predictionValues' to 'predictions' to match backend DTO
const rawPredictions = ref({ names: [], predictions: [] });
const graphData = ref({ nodes: [], relationships: [] });

// --- Constants ---
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan']; // These are the tool names
const strategies = ['UNION', 'INTERSECTION', 'AT_LEAST_TWO']; // Backend values for toolSelection

const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASSWORD = 'test1234';
let driver;

const graphInstance = ref();
const edgeTooltipRef = ref();
const targetEdgeId = ref("");
const edgeTooltipOpacity = ref(0);
const edgeTooltipPos = ref({ left: "0px", top: "0px" });
const mousePosition = ref({ x: 0, y: 0 });

// Disable graph view if multiple miRNAs are selected, as the current graph logic is for single miRNA
const graphViewDisabled = computed(() => {
  const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
  return mirnaList.length > 1 && searchMode.value === 'multiple';
});

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
    normal: {width: 2, color: "red"}, hover: {width: 3, color: "darkred"}, selected: {width: 3, color: "orange"},
    label: { visible: false }, gap: 15,
    marker: { target: {type: "arrow", width: 5, height: 5, margin: -2.5, units: "strokeWidth", color: "red"} }
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
    }, {flush: 'post'}
);

const graphEventHandlers = {
  "edge:pointerover": (event) => {
    const domPointerEvent = event.event;
    if (domPointerEvent && typeof domPointerEvent.clientX === 'number' && typeof domPointerEvent.clientY === 'number') {
      const graphContainerEl = graphInstance.value?.$el;
      if (graphContainerEl) {
        const containerRect = graphContainerEl.getBoundingClientRect();
        mousePosition.value = { x: domPointerEvent.clientX - containerRect.left, y: domPointerEvent.clientY - containerRect.top, };
      } else { mousePosition.value = {x: domPointerEvent.clientX, y: domPointerEvent.clientY}; }
    }
    targetEdgeId.value = event.edge || ""; edgeTooltipOpacity.value = 1;
  },
  "edge:pointerout": () => { edgeTooltipOpacity.value = 0; },
};

async function fetchGraphData(mirnaNameToSearch, selectedToolsForGraph, mergeStrategyForGraph) {
  if (!driver) { console.error('Neo4j driver not available.'); graphData.value = { nodes: [], relationships: [] }; return; }
  let session;
  try {
    session = driver.session({ database: 'neo4j' });
    const params = { mirnaNameParam: mirnaNameToSearch, selectedToolsParam: selectedToolsForGraph };
    let cypherQuery = '';
    const baseMatch = `MATCH (mir:microRNA {name: $mirnaNameParam})`;
    const toolTypes = selectedToolsForGraph.length > 0 ? selectedToolsForGraph.join('|') : 'PicTar|RNA22|TargetScan|miRTarBase';
    let targetFindingClause = '';
    if (mergeStrategyForGraph === 'INTERSECTION' && selectedToolsForGraph.length > 0) {
      if (selectedToolsForGraph.length < 1) { /* Using alert() is not allowed, use a custom modal or message box */ console.error("Intersection strategy requires at least one tool."); graphData.value = {nodes:[], relationships:[]}; return; }
      targetFindingClause = `OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target) WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge WHERE target IS NOT NULL AND size(toolsOnEdge) = size($selectedToolsParam) AND ALL(selTool IN $selectedToolsParam WHERE selTool IN toolsOnEdge) WITH mir, target, toolsOnEdge`;
    } else if (mergeStrategyForGraph === 'AT_LEAST_TWO' && selectedToolsForGraph.length > 0) {
      if (selectedToolsForGraph.length < 2) { /* Using alert() is not allowed, use a custom modal or message box */ console.error("'At least two tools' strategy requires selecting at least two tools."); graphData.value = {nodes:[], relationships:[]}; return; }
      targetFindingClause = `OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target) WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge WHERE target IS NOT NULL AND size(toolsOnEdge) >= 2 WITH mir, target, toolsOnEdge`;
    } else { targetFindingClause = `OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target) WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge WHERE target IS NULL OR size(toolsOnEdge) > 0 WITH mir, target, toolsOnEdge`; }

    cypherQuery = `
      ${baseMatch}
      ${targetFindingClause}
      OPTIONAL MATCH (target)-[r_path:PART_OF_PATHWAY]->(pathway:Pathway)
      RETURN mir, target, toolsOnEdge, pathway, r_path
    `;
    console.log("--- GRAPH QUERY ---"); console.log("Strategy:", mergeStrategyForGraph, "Tools:", selectedToolsForGraph); console.log(cypherQuery); console.log("Params:", params); console.log("--------------------");
    const result = await session.run(cypherQuery, params);
    console.log(`[DEBUG] fetchGraphData: Neo4j query returned ${result.records.length} records.`);
    const tempNodes = new Map(); const tempRelationships = new Map();
    result.records.forEach(record => {
      const mir = record.get('mir'); const target = record.get('target'); const toolsOnEdge = record.get('toolsOnEdge'); const pathwayNode = record.get('pathway'); const pathwayRel = record.get('r_path');
      if (mir && mir.elementId && !tempNodes.has(mir.elementId)) { tempNodes.set(mir.elementId, { id: mir.elementId, label: mir.properties.name || 'miRNA', type: 'microRNA', properties: mir.properties }); }
      if (target && target.elementId && !tempNodes.has(target.elementId)) { tempNodes.set(target.elementId, { id: target.elementId, label: target.properties.name || 'Target', type: 'Target', properties: target.properties }); }
      if (mir && target && toolsOnEdge && toolsOnEdge.length > 0) { const edgeId = `mirtarget-${mir.elementId}-${target.elementId}`; if (!tempRelationships.has(edgeId)) { tempRelationships.set(edgeId, { id: edgeId, source: mir.elementId, target: target.elementId, label: toolsOnEdge.join(', ') }); } }
      if (target && pathwayNode && pathwayRel && pathwayNode.elementId && pathwayRel.elementId) {
        if (!tempNodes.has(pathwayNode.elementId)) { tempNodes.set(pathwayNode.elementId, { id: pathwayNode.elementId, label: pathwayNode.properties.name || 'Pathway', type: 'Pathway', properties: pathwayNode.properties }); }
        if (!tempRelationships.has(pathwayRel.elementId)) { if (tempNodes.has(target.elementId) && tempNodes.has(pathwayNode.elementId)) { tempRelationships.set(pathwayRel.elementId, { id: pathwayRel.elementId, source: target.elementId, target: pathwayNode.elementId, label: pathwayRel.type || "PART_OF_PATHWAY" }); } else { console.warn("Skipping pathway edge, source or target node not found in tempNodes map:", pathwayRel); } }
      }
    });
    console.log("[DEBUG] fetchGraphData: tempNodes map size:", tempNodes.size); console.log("[DEBUG] fetchGraphData: tempRelationships map size:", tempRelationships.size);
    graphData.value = { nodes: Array.from(tempNodes.values()), relationships: Array.from(tempRelationships.values()) };
  } catch (error) { console.error(`[DEBUG] fetchGraphData: Error for ${mirnaNameToSearch}:`, error); graphData.value = { nodes: [], relationships: [] }; } finally { if (session) await session.close(); }
}

onMounted(() => { try { driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)); driver.verifyConnectivity().then(() => console.log('Neo4j driver connected.')).catch(err => console.error('Neo4j connect error:', err)); } catch (e) { console.error('Neo4j init error:', e); } });
onUnmounted(async () => { if (driver) await driver.close().then(()=> console.log('Neo4j driver closed.')); });

async function fetchTableData(mirnaNameList) {
  console.log(`[Table Fetch] Requesting predictions for: ${mirnaNameList.join(', ')}`);
  try {
    // Construct query parameters for the new backend endpoint
    const params = new URLSearchParams();
    mirnaNameList.forEach(name => params.append('miRNANames', name));
    selectedHeuristics.value.forEach(tool => params.append('tools', tool));
    params.append('toolSelection', mergeStrategy.value);
    params.append('heuristic', heuristicStrategy.value);

    // Make a single API call to the new endpoint
    const response = await axios.get(`/api/predictions?${params.toString()}`);

    // The backend now returns a 'Prediction' object with 'names' and 'predictions'
    // CORRECTED LINE: Ensure this matches the DTO structure
    rawPredictions.value = response.data;
    console.log('[Table Fetch] rawPredictions.value (from backend):', JSON.parse(JSON.stringify(rawPredictions.value)));

  } catch (error) {
    console.error(`[Table Fetch] Error fetching table predictions for ${mirnaNameList.join(', ')}:`, error);
    // CORRECTED LINE: Ensure this matches the DTO structure for error state
    rawPredictions.value = { names: [], predictions: [] };
  }
}

const filteredPredictions = computed(() => {
  // CORRECTED LINE: Changed 'predictionValues' to 'predictions'
  if (!rawPredictions.value || !rawPredictions.value.predictions || rawPredictions.value.predictions.length === 0) {
    return [];
  }

  // The backend already applied toolSelection and heuristic logic.
  // We just need to format the data for the table.
  const predictionsForTable = rawPredictions.value.predictions.map(pred => ({
    gene: pred.gene,
    tools: pred.tools,
    pathways: pred.pathways.length > 0 ? pred.pathways : ["N/A"],
    // The backend's 'names' array contains all input miRNAs.
    // For the table, we show all miRNAs involved in the prediction.
    mirnasInvolved: rawPredictions.value.names,
  }));

  console.log("[Filtered Table] Formatted predictions for table:", predictionsForTable);
  return predictionsForTable;
});

// --- UI Actions ---
const toggleTitleCollapse = () => {
  isTitleCollapsed.value = !isTitleCollapsed.value;
  hasTitleBeenCollapsedByAction.value = true;
};

const toggleSearchModeAndCollapseTitle = () => {
  searchMode.value = searchMode.value === 'single' ? 'multiple' : 'single';
  if (!hasTitleBeenCollapsedByAction.value) {
    isTitleCollapsed.value = true;
  }
  // Clear mirnas input when switching mode for clarity
  mirnas.value = '';
  // Reset output when switching mode
  showOutput.value = false;
  // CORRECTED LINE: Ensure this matches the DTO structure
  rawPredictions.value = { names: [], predictions: [] };
  graphData.value = { nodes: [], relationships: [] };
};

const submitSearchAndCollapseTitle = async () => {
  isLoading.value = true;
  showOutput.value = false; // Hide previous output while loading
  // CORRECTED LINE: Ensure this matches the DTO structure
  rawPredictions.value = { names: [], predictions: [] }; // Clear previous table data
  graphData.value = { nodes: [], relationships: [] }; // Clear previous graph data

  const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (mirnaList.length === 0) {
    console.warn("No miRNA names entered.");
    isLoading.value = false;
    return;
  }

  // Store the input for display
  inputtedMirna.value = mirnas.value;
  inputtedMirnaForDisplay.value = mirnaList.join(', ');

  // Collapse title if not already collapsed by user action
  if (!hasTitleBeenCollapsedByAction.value) {
    isTitleCollapsed.value = true;
  }

  try {
    // Fetch table data using the new unified backend endpoint
    await fetchTableData(mirnaList);

    // Only fetch graph data if in single search mode and a single miRNA is provided
    if (searchMode.value === 'single' && mirnaList.length === 1) {
      await fetchGraphData(mirnaList[0], selectedHeuristics.value, mergeStrategy.value);
    } else {
      // If not in graph-compatible mode, ensure graphData is empty
      graphData.value = { nodes: [], relationships: [] };
    }

    showOutput.value = true;
  } catch (error) {
    console.error("Error during search submission:", error);
    // Handle error, e.g., show a message to the user
  } finally {
    isLoading.value = false;
    graphDataKey.value++; // Force graph re-render
  }
};

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph';
};

const showPastSearches = () => {
  // Implement logic to show past searches (e.g., a dialog with a list)
  console.log("Show past searches clicked!");
  // This part is not directly related to the backend API change,
  // so its implementation remains as per your original design.
};

const exportTableData = () => {
  if (!filteredPredictions.value || filteredPredictions.value.length === 0) {
    console.warn("No data to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  // Add header row
  csvContent += "miRNA(s),Tool(s),Gene,Pathway(s)\n";

  // Add data rows
  filteredPredictions.value.forEach(row => {
    const mirnas = Array.isArray(row.mirnasInvolved) ? `"${row.mirnasInvolved.join(';')}"` : `"${row.mirna || inputtedMirnaForDisplay.value}"`;
    const tools = Array.isArray(row.tools) ? `"${row.tools.join(';')}"` : "";
    const gene = `"${row.gene}"`;
    const pathways = Array.isArray(row.pathways) ? `"${row.pathways.join(';')}"` : "";
    csvContent += `${mirnas},${tools},${gene},${pathways}\n`;
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

<style scoped>
.fill-height { height: 100%; }
.bio-bg { background: linear-gradient(135deg, #e0f7fa, #f0faee); position: relative; overflow: hidden; }
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
  opacity: 0.07; /* You might want to temporarily increase this for debugging to e.g. 0.5 */
  animation: scrollBackground 60s linear infinite;
  background-image: url("data:image/svg+xml,%3Csvg width='300' height='800' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2388c0d0' stroke-width='3'%3E%3Cpath d='M150 0 C280 50, 20 150, 150 200 C280 250, 20 350, 150 400 C280 450, 20 550, 150 600 C280 650, 20 750, 150 800'/%3E%3C/g%3E%3Cg fill='%23cba8ff'%3E%3Ccircle cx='150' cy='50' r='4'/%3E%3Ccircle cx='150' cy='150' r='4'/%3E%3Ccircle cx='150' cy='250' r='4'/%3E%3Ccircle cx='150' cy='350' r='4'/%3E%3Ccircle cx='150' cy='450' r='4'/%3E%3Ccircle cx='150' cy='550' r='4'/%3E%3Ccircle cx='150' cy='650' r='4'/%3E%3Ccircle cx='150' cy='750' r='4'/%3E%3C/g%3E%3C/svg%3E");
}
@keyframes scrollBackground { 0% { background-position: 0 0; } 100% { background-position: 0 800px; } }
.z-index-1 { z-index: 1; position: relative; }
.w-100 { width: 100%; }
.edge-tooltip { top: 0; left: 0; opacity: 0; position: absolute; padding: 6px 10px; font-size: 12px; background-color: #fff0bd; border: 1px solid #ffb950; border-radius: 4px; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); transition: opacity 0.2s ease-out; pointer-events: none; white-space: nowrap; z-index: 10; }
.cursor-pointer { cursor: pointer; }
</style>