<template>
  <v-container
      fluid
      class="pa-10 bio-bg text-grey-darken-4 d-flex flex-column"
      style="min-height: 100vh;"
  >
    <div class="dna-bg"></div>

    <!-- TITLE SECTION (Collapsible) -->
    <div
        class="text-center position-relative z-index-1"
        :class="{ 'mb-0': !isTitleCollapsed, 'mb-4': isTitleCollapsed }"
        @click="toggleTitleCollapse"
        :style="isTitleCollapsed ? 'cursor: pointer;' : ''"
    >
      <template v-if="!isTitleCollapsed">
        <v-icon size="64" color="green darken-2">mdi-dna</v-icon>
        <h1 class="text-h4 font-weight-bold mt-2">miRNA Target Gene & Pathway Analyzer</h1>
        <h2 class="subtitle-1 text-grey mt-1 mb-12">
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
    <!-- END OF TITLE SECTION -->

    <!-- CONTENT ROW - WRAP THIS IN A FLEX-GROW DIV for centering -->
    <div class="d-flex flex-grow-1 align-center">
      <v-row justify="center" class="z-index-1 position-relative w-100">
        <v-col cols="12" md="6" lg="5">
          <v-card
              class="pa-6 rounded-lg elevation-10 d-flex flex-column justify-center"
              style="min-height:450px"
          >
            <v-form @submit.prevent="submitSearchAndCollapseTitle">
              <!-- Search Mode Title and Toggle Chip -->
              <div class="text-center mb-4 d-flex justify-space-between align-center">
                <h3 class="text-h6 font-weight-medium text-grey-darken-2">
                  {{ searchMode === 'single' ? 'Single miRNA Search' : 'Multiple miRNAs Search' }}
                </h3>
                <v-tooltip location="bottom">
                  <template #activator="{ props: tooltipProps }">
                    <v-chip
                        v-bind="tooltipProps"
                        @click="toggleSearchModeAndCollapseTitle"
                        color="green-darken-1"
                        variant="outlined"
                        label
                        small
                        class="cursor-pointer"
                        style="user-select: none;"
                        aria-label="Switch search mode"
                    >
                      <v-icon left small class="mr-1">mdi-swap-horizontal-bold</v-icon>
                      Switch
                    </v-chip>
                  </template>
                  <span>Switch to {{ searchMode === 'single' ? 'Multiple miRNAs' : 'Single miRNA' }} Search Mode</span>
                </v-tooltip>
              </div>

              <v-textarea
                  v-model="mirnas"
                  :label="searchMode === 'single' ? 'Enter a single miRNA' : 'Enter miRNA(s)'"
                  auto-grow
                  rows="1"
                  outlined
                  class="mb-4"
                  persistent-hint
                  hint=" "
              >
                <template #append-inner>
                  <v-tooltip location="top">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" small class="ml-1">mdi-information-outline</v-icon>
                    </template>
                    <span v-if="searchMode === 'single'">e.g., mmu-let-7a-5p</span>
                    <span v-else>Separate with commas or newlines</span>
                  </v-tooltip>
                </template>
              </v-textarea>

              <v-select
                  v-model="selectedHeuristics"
                  :items="heuristics"
                  label="Select Tools"
                  multiple
                  chips
                  outlined
                  class="mb-2 mt-4"
              >
                <template #append>
                  <v-tooltip text="Select prediction tools. Affects graph & table.">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                    </template>
                  </v-tooltip>
                </template>
              </v-select>

              <v-select
                  v-model="mergeStrategy"
                  :items="strategies"
                  label="Select Tool Merge Strategy"
                  outlined
                  chips
                  class="mb-4 mt-4"
              >
                <template #append>
                  <v-tooltip text="'union' = targets from any selected tool, 'intersection' = targets common to ALL selected tools, 'at least two tools' = targets predicted by >= 2 selected tools. Affects graph & table.">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon>
                    </template>
                  </v-tooltip>
                </template>
              </v-select>

              <v-select
                  v-if="searchMode === 'multiple'"
                  v-model="heuristicStrategy"
                  :items="heuristicStrategies"
                  label="Select Multi-miRNA Heuristic Strategy"
                  outlined
                  chips
                  class="mb-4 mt-4"
              >
                <template #append>
                  <v-tooltip text="'union' = targets if any miRNA predicts them, 'intersection' = targets ONLY if ALL miRNAs predict them, 'majority' = targets if >50% of miRNAs predict them. (Affects Table View for multiple miRNAs)">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" small class="ml-2">mdi-account-group-outline</v-icon>
                    </template>
                  </v-tooltip>
                </template>
              </v-select>

              <div class="text-center">
                <v-btn type="submit" color="green darken-1" dark :loading="isLoading">
                  <v-icon left>mdi-magnify</v-icon> Analyze
                </v-btn>
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
            <div class="d-flex justify-end mb-2">
              <v-btn
                  color="green darken-1"
                  @click="toggleViewMode"
                  small
                  dark
                  :disabled="graphViewDisabled"
              >
                <v-icon left>mdi-swap-horizontal</v-icon>
                {{ viewMode === 'graph' ? 'Switch to Table View' : 'Switch to Graph View' }}
              </v-btn>
            </div>

            <div
                v-if="viewMode === 'graph'"
                id="network-visualization-container-wrapper"
                class="pa-4 elevation-2 rounded-lg"
                style="width: 100%; height: 400px; background-color: #f0f2f5; border: 1px solid #ccc; overflow: hidden; position: relative;"
            >
              <template v-if="processedGraphNodes && typeof processedGraphNodes === 'object' && Object.keys(processedGraphNodes).length > 0 && !isLoading">
                <v-network-graph
                    ref="graphInstance"
                    :key="graphDataKey"
                    :nodes="processedGraphNodes"
                    :edges="processedGraphEdges"
                    :configs="graphConfigs"
                    :event-handlers="graphEventHandlers"
                    class="graph-bg"
                    style="width: 100%; height: 100%;"
                />
                <div
                    ref="edgeTooltipRef"
                    class="edge-tooltip"
                    :style="{ ...edgeTooltipPos, opacity: edgeTooltipOpacity }"
                >
                  <div v-if="hoveredEdgeDetails">
                    {{ hoveredEdgeDetails.name }}
                  </div>
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
              <div v-if="filteredPredictions.length">
                <v-table dense>
                  <thead>
                  <tr>
                    <th>miRNA(s)</th>
                    <th>Tool(s)</th>
                    <th>Gene</th>
                    <th>Pathway(s)</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="(prediction, index) in filteredPredictions" :key="`${prediction.gene}-${index}`">
                    <td>
                      <v-chip v-if="Array.isArray(prediction.mirnasInvolved)" v-for="mir in prediction.mirnasInvolved" :key="mir" small class="ma-1">{{ mir }}</v-chip>
                      <span v-else>{{ prediction.mirna || inputtedMirnaForDisplay }}</span>
                    </td>
                    <td>
                      <v-chip v-for="(tool, i) in prediction.tools" :key="i" class="ma-1" small>{{ tool }}</v-chip>
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
                <p class="text-subtitle-1">No table predictions found for "{{ inputtedMirnaForDisplay }}" based on the selected criteria.</p>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </div> <!-- END OF ADDED WRAPPER for flex-grow -->
  </v-container>
</template>

<script setup>
import {ref, computed, onMounted, onUnmounted, reactive, watch} from 'vue';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import {VNetworkGraph, defineConfigs} from "v-network-graph";
import {ForceLayout} from "v-network-graph/lib/force-layout";
import "v-network-graph/lib/style.css";

// --- Page State ---
const mirnas = ref('');
const inputtedMirna = ref(''); // Stores the miRNA(s) actually submitted for the query
const inputtedMirnaForDisplay = ref(''); // For UI display, can be "miRNA1, miRNA2" or "Multiple miRNAs"
const searchMode = ref('single'); // 'single' or 'multiple'

const selectedHeuristics = ref([]); // Tools like TargetScan, PicTar etc.
const mergeStrategy = ref('union(only for testing)'); // For how selectedHeuristics combine for ONE miRNA

// For multiple miRNA search mode
const heuristicStrategy = ref('union'); // How results from MULTIPLE miRNAs are combined for a gene
const heuristicStrategies = ['union', 'intersection', 'majority'];

const viewMode = ref('graph');
const showOutput = ref(false);
const isLoading = ref(false);
const graphDataKey = ref(0);

// For title collapse
const isTitleCollapsed = ref(false);
const hasTitleBeenCollapsedByAction = ref(false);

// --- Data ---
const rawPredictions = ref([]);
const graphData = ref({nodes: [], relationships: []});

// --- Constants ---
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['union(only for testing)', 'intersection', 'at least two tools'];

// --- Neo4j Driver Setup ---
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASSWORD = 'test1234';
let driver;

// --- Graph Instance and Tooltip Refs ---
const graphInstance = ref();
const edgeTooltipRef = ref();

// --- Tooltip State ---
const targetEdgeId = ref("");
const edgeTooltipOpacity = ref(0);
const edgeTooltipPos = ref({left: "0px", top: "0px"});
const mousePosition = ref({x: 0, y: 0});

// --- Graph View Disabler ---
const graphViewDisabled = computed(() => {
  const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
  return mirnaList.length > 1 && searchMode.value === 'multiple';
});

// --- Graph Configurations ---
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
    label: {
      visible: true,
      fontFamily: "Roboto, sans-serif",
      fontSize: 10,
      color: "#333333",
      margin: 4,
      direction: "south",
      text: "name"
    },
    normal: {radius: node => node.radius || 8, color: node => node.color || "#88c0d0"},
    hover: {radius: node => (node.radius || 8) + 2},
    selected: {strokeWidth: 2, strokeColor: "#EAB308"}
  },
  edge: {
    selectable: true, hoverable: true,
    normal: {width: 2, color: "red"}, hover: {width: 3, color: "darkred"}, selected: {width: 3, color: "orange"},
    label: {visible: false}, gap: 15,
    marker: {target: {type: "arrow", width: 5, height: 5, margin: -2.5, units: "strokeWidth", color: "red"}}
  },
});

// --- Processed Graph Data (Computed Properties) ---
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
        } else {
          console.warn("ProcessedGraphNodes: Skipping node due to missing id or node itself is null/undefined:", node);
        }
      }
    } else if (graphData.value && graphData.value.nodes) {
      console.warn("ProcessedGraphNodes: graphData.value.nodes is not an array. Value:", graphData.value.nodes);
    }
    return nodesObject;
  } catch (e) {
    console.error("Error inside processedGraphNodes computed property:", e);
    return {};
  }
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
          edgesObject[edgeId] = {
            source: String(rel.source),
            target: String(rel.target),
            name: rel.label || ''
          };
        } else {
          console.warn("ProcessedGraphEdges: Skipping edge due to missing id/source/target or edge itself is null/undefined:", rel);
        }
      }
    } else if (graphData.value && graphData.value.relationships) {
      console.warn("ProcessedGraphEdges: graphData.value.relationships is not an array. Value:", graphData.value.relationships);
    }
    return edgesObject;
  } catch (e) {
    console.error("Error inside processedGraphEdges computed property:", e);
    return {};
  }
});

const hoveredEdgeDetails = computed(() => {
  if (!targetEdgeId.value || !processedGraphEdges.value[targetEdgeId.value]) {
    return null;
  }
  return processedGraphEdges.value[targetEdgeId.value];
});

// --- Watcher for Edge Tooltip Position ---
watch(
    [edgeTooltipOpacity, targetEdgeId, () => edgeTooltipRef.value],
    () => {
      if (!edgeTooltipRef.value || edgeTooltipOpacity.value === 0 || !targetEdgeId.value) {
        return;
      }
      const tooltipHeight = edgeTooltipRef.value.offsetHeight;
      const desiredOffsetYAboveCursor = 2;
      const desiredOffsetXToLeftOfCursor = 6;
      const top = mousePosition.value.y - tooltipHeight - desiredOffsetYAboveCursor;
      const left = mousePosition.value.x - desiredOffsetXToLeftOfCursor;
      edgeTooltipPos.value = {left: left + "px", top: top + "px"};
    },
    {flush: 'post'}
);

// --- Graph Event Handlers ---
const graphEventHandlers = {
  "edge:pointerover": (event) => {
    const domPointerEvent = event.event;
    if (domPointerEvent && typeof domPointerEvent.clientX === 'number' && typeof domPointerEvent.clientY === 'number') {
      const graphContainerEl = graphInstance.value?.$el;
      if (graphContainerEl) {
        const containerRect = graphContainerEl.getBoundingClientRect();
        mousePosition.value = {
          x: domPointerEvent.clientX - containerRect.left,
          y: domPointerEvent.clientY - containerRect.top,
        };
      } else {
        mousePosition.value = {x: domPointerEvent.clientX, y: domPointerEvent.clientY};
      }
    }
    targetEdgeId.value = event.edge || "";
    edgeTooltipOpacity.value = 1;
  },
  "edge:pointerout": () => {
    edgeTooltipOpacity.value = 0;
  },
};

// --- Data Fetching Functions ---
async function fetchGraphData(mirnaNameToSearch, selectedToolsForGraph, mergeStrategyForGraph) {
  if (!driver) {
    console.error('Neo4j driver not available.');
    graphData.value = {nodes: [], relationships: []};
    return;
  }
  let session;
  try {
    session = driver.session({database: 'neo4j'});
    const params = {mirnaNameParam: mirnaNameToSearch, selectedToolsParam: selectedToolsForGraph};
    let cypherQuery = '';

    const baseMatch = `MATCH (mir:microRNA {name: $mirnaNameParam})`;
    const toolTypes = selectedToolsForGraph.length > 0 ? selectedToolsForGraph.join('|') : 'PicTar|RNA22|TargetScan|miRTarBase';

    let targetFindingClause = '';
    if (mergeStrategyForGraph === 'intersection' && selectedToolsForGraph.length > 0) {
      if (selectedToolsForGraph.length < 1) {
        alert("Intersection strategy requires at least one tool.");
        graphData.value = {nodes: [], relationships: []};
        return;
      }
      targetFindingClause = `
        OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target)
        WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge
        WHERE target IS NOT NULL AND size(toolsOnEdge) = size($selectedToolsParam) AND ALL(selTool IN $selectedToolsParam WHERE selTool IN toolsOnEdge)
        WITH mir, target, toolsOnEdge
      `;
    } else if (mergeStrategyForGraph === 'at least two tools' && selectedToolsForGraph.length > 0) {
      if (selectedToolsForGraph.length < 2) {
        alert("'At least two tools' strategy requires selecting at least two tools.");
        graphData.value = {nodes: [], relationships: []};
        return;
      }
      targetFindingClause = `
        OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target)
        WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge
        WHERE target IS NOT NULL AND size(toolsOnEdge) >= 2
        WITH mir, target, toolsOnEdge
      `;
    } else {
      targetFindingClause = `
        OPTIONAL MATCH (mir)-[r_tool:${toolTypes}]->(target:Target)
        WITH mir, target, COLLECT(DISTINCT type(r_tool)) AS toolsOnEdge
        WHERE target IS NULL OR size(toolsOnEdge) > 0
        WITH mir, target, toolsOnEdge
      `;
    }
    cypherQuery = `
      ${baseMatch}
      ${targetFindingClause}
      OPTIONAL MATCH (target)-[r_path:PART_OF_PATHWAY]->(pathway:Pathway)
      RETURN mir, target, toolsOnEdge, COLLECT(DISTINCT pathway) AS pathways, COLLECT(DISTINCT r_path) AS pathwayRels
    `;
    console.log("--- GRAPH QUERY ---");
    console.log("Strategy:", mergeStrategyForGraph, "Tools:", selectedToolsForGraph);
    console.log(cypherQuery);
    console.log("Params:", params);
    console.log("--------------------");
    const result = await session.run(cypherQuery, params);
    console.log(`[DEBUG] fetchGraphData: Neo4j query returned ${result.records.length} records.`);
    const tempNodes = new Map();
    const tempRelationships = new Map();
    result.records.forEach(record => {
      const mir = record.get('mir');
      const target = record.get('target');
      const toolsOnEdge = record.get('toolsOnEdge');
      const pathways = record.get('pathways');
      const pathwayRels = record.get('pathwayRels');
      if (mir && mir.elementId && !tempNodes.has(mir.elementId)) {
        tempNodes.set(mir.elementId, {
          id: mir.elementId,
          label: mir.properties.name || 'miRNA',
          type: 'microRNA',
          properties: mir.properties
        });
      }
      if (target && target.elementId && !tempNodes.has(target.elementId)) {
        tempNodes.set(target.elementId, {
          id: target.elementId,
          label: target.properties.name || 'Target',
          type: 'Target',
          properties: target.properties
        });
      }
      if (mir && target && toolsOnEdge && toolsOnEdge.length > 0) {
        const edgeId = `mirtarget-${mir.elementId}-${target.elementId}`;
        if (!tempRelationships.has(edgeId)) {
          tempRelationships.set(edgeId, {
            id: edgeId,
            source: mir.elementId,
            target: target.elementId,
            label: toolsOnEdge.join(', ')
          });
        }
      }
      if (target && pathways && pathwayRels) {
        pathways.forEach((pathwayNode) => {
          if (pathwayNode && pathwayNode.elementId && !tempNodes.has(pathwayNode.elementId)) {
            tempNodes.set(pathwayNode.elementId, {
              id: pathwayNode.elementId,
              label: pathwayNode.properties.name || 'Pathway',
              type: 'Pathway',
              properties: pathwayNode.properties
            });
          }
          const rel = pathwayRels.find(r => (r.start.toString() === target.elementId && r.end.toString() === pathwayNode.elementId) || (r.end.toString() === target.elementId && r.start.toString() === pathwayNode.elementId));
          if (pathwayNode && rel && rel.elementId && !tempRelationships.has(rel.elementId)) {
            if (tempNodes.has(target.elementId) && tempNodes.has(pathwayNode.elementId)) {
              tempRelationships.set(rel.elementId, {
                id: rel.elementId,
                source: rel.start.toString(),
                target: rel.end.toString(),
                label: rel.type
              });
            }
          }
        });
      }
    });
    console.log("[DEBUG] fetchGraphData: tempNodes map size:", tempNodes.size);
    console.log("[DEBUG] fetchGraphData: tempRelationships map size:", tempRelationships.size);
    graphData.value = {nodes: Array.from(tempNodes.values()), relationships: Array.from(tempRelationships.values())};
  } catch (error) {
    console.error(`[DEBUG] fetchGraphData: Error for ${mirnaNameToSearch}:`, error);
    graphData.value = {nodes: [], relationships: []};
  } finally {
    if (session) await session.close();
  }
}

onMounted(() => {
  try {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    driver.verifyConnectivity().then(() => console.log('Neo4j driver connected.')).catch(err => console.error('Neo4j connect error:', err));
  } catch (e) {
    console.error('Neo4j init error:', e);
  }
});
onUnmounted(async () => {
  if (driver) await driver.close().then(() => console.log('Neo4j driver closed.'));
});

async function fetchTableData(mirnaNameList) {
  console.log(`[Table Fetch] Requesting predictions for: ${mirnaNameList.join(', ')}`);
  let allIndividualPredictions = [];
  try {
    for (const mirnaName of mirnaNameList) {
      const response = await axios.get(`/api/mirna/predictions?name=${mirnaName}`);
      const predictionsFromApi = Array.isArray(response.data.predictions) ? response.data.predictions : [];
      if (predictionsFromApi.length > 0) {
        predictionsFromApi.forEach(pred => {
          const geneName = pred.gene_symbol || pred.gene || "N/A";
          let toolsList = Array.isArray(pred.tools) ? pred.tools : [];
          let meetsToolMergeCriteria = true;
          if (selectedHeuristics.value.length > 0) {
            const relevantTools = toolsList.filter(tool => selectedHeuristics.value.includes(tool));
            if (mergeStrategy.value === 'intersection') {
              meetsToolMergeCriteria = selectedHeuristics.value.every(st => relevantTools.includes(st));
            } else if (mergeStrategy.value === 'at least two tools') {
              meetsToolMergeCriteria = relevantTools.length >= 2;
            }
            if (meetsToolMergeCriteria && relevantTools.length === 0 && selectedHeuristics.value.length > 0) {
              meetsToolMergeCriteria = false;
            }
            toolsList = relevantTools;
          }
          if (meetsToolMergeCriteria && (toolsList.length > 0 || selectedHeuristics.value.length === 0)) {
            const pathwaysList = Array.isArray(pred.pathways) && pred.pathways.length > 0 ? pred.pathways : ["N/A"];
            pathwaysList.forEach(pathway => {
              allIndividualPredictions.push({mirna: mirnaName, gene: geneName, tools: toolsList, pathways: [pathway],});
            });
          }
        });
      }
    }
    rawPredictions.value = allIndividualPredictions;
    console.log('[Table Fetch] rawPredictions.value (pre-multi-miRNA strategy):', JSON.parse(JSON.stringify(rawPredictions.value)));
  } catch (error) {
    console.error(`[Table Fetch] Error fetching table predictions for ${mirnaNameList.join(', ')}:`, error);
    rawPredictions.value = [];
  }
}

const filteredPredictions = computed(() => {
  if (!rawPredictions.value || rawPredictions.value.length === 0) return [];
  let currentPredictions = JSON.parse(JSON.stringify(rawPredictions.value));
  const mirnaListForFiltering = inputtedMirna.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (searchMode.value === 'multiple' && mirnaListForFiltering.length > 1) {
    const geneToMirnasMap = {};
    currentPredictions.forEach(p => {
      if (!geneToMirnasMap[p.gene]) {
        geneToMirnasMap[p.gene] = {
          mirnasInvolved: new Set(),
          allToolsForGene: new Set(),
          allPathwaysForGene: new Set()
        };
      }
      geneToMirnasMap[p.gene].mirnasInvolved.add(p.mirna);
      p.tools.forEach(t => geneToMirnasMap[p.gene].allToolsForGene.add(t));
      p.pathways.forEach(path => geneToMirnasMap[p.gene].allPathwaysForGene.add(path));
    });
    const finalFiltered = [];
    for (const gene in geneToMirnasMap) {
      const data = geneToMirnasMap[gene];
      const numMirnasPredictingGene = data.mirnasInvolved.size;
      let meetsMultiMirnaCriteria = false;
      if (heuristicStrategy.value === 'union') {
        meetsMultiMirnaCriteria = numMirnasPredictingGene > 0;
      } else if (heuristicStrategy.value === 'intersection') {
        meetsMultiMirnaCriteria = numMirnasPredictingGene === mirnaListForFiltering.length;
      } else if (heuristicStrategy.value === 'majority') {
        meetsMultiMirnaCriteria = numMirnasPredictingGene > mirnaListForFiltering.length / 2;
      }
      if (meetsMultiMirnaCriteria) {
        finalFiltered.push({
          gene: gene,
          mirnasInvolved: Array.from(data.mirnasInvolved),
          tools: Array.from(data.allToolsForGene),
          pathways: Array.from(data.allPathwaysForGene).length > 0 ? Array.from(data.allPathwaysForGene) : ["N/A"],
        });
      }
    }
    console.log(`[Filtered Table] Multi-miRNA strategy '${heuristicStrategy.value}' applied. Result:`, finalFiltered);
    return finalFiltered;
  } else {
    console.log("[Filtered Table] Single miRNA mode or fallback. Result:", currentPredictions);
    return currentPredictions.map(p => ({
      ...p,
      pathways: p.pathways.length > 0 && p.pathways[0] !== "N/A" ? p.pathways : ["N/A"]
    }));
  }
});

// --- Title Collapse Logic ---
function collapseTitleIfNeeded() {
  if (!isTitleCollapsed.value) {
    isTitleCollapsed.value = true;
  }
}

function toggleTitleCollapse() {
  isTitleCollapsed.value = !isTitleCollapsed.value;
  if (!isTitleCollapsed.value) {
    hasTitleBeenCollapsedByAction.value = false;
  }
}

// --- End Title Collapse Logic ---

// Wrapper for submitSearch to include title collapse
async function submitSearchAndCollapseTitle() {
  collapseTitleIfNeeded();
  hasTitleBeenCollapsedByAction.value = true;
  await submitSearch();
}

// Main submitSearch logic
async function submitSearch() {
  isLoading.value = true;
  showOutput.value = false;
  graphDataKey.value++;
  rawPredictions.value = [];
  graphData.value = {nodes: [], relationships: []};

  const currentMirnasInput = mirnas.value;
  const mirnaList = currentMirnasInput.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (mirnaList.length === 0) {
    alert('Please enter at least one miRNA.');
    isLoading.value = false;
    showOutput.value = false;
    return;
  }

  // Set inputtedMirna for internal logic and inputtedMirnaForDisplay for UI
  inputtedMirna.value = mirnaList.join(', '); // Store all for potential multi-miRNA logic later

  if (searchMode.value === 'single') {
    if (mirnaList.length > 1) {
      alert('Single miRNA Search mode: Please enter only one miRNA. Processing the first miRNA entered.');
    }
    const singleMirnaToProcess = mirnaList[0];
    inputtedMirnaForDisplay.value = singleMirnaToProcess; // Display only the one being processed
    await Promise.all([
      fetchTableData([singleMirnaToProcess]),
      fetchGraphData(singleMirnaToProcess, selectedHeuristics.value, mergeStrategy.value)
    ]);
  } else { // searchMode === 'multiple'
    inputtedMirnaForDisplay.value = mirnaList.length > 1 ? `Multiple miRNAs (${mirnaList.length})` : (mirnaList[0] || "N/A");
    await fetchTableData(mirnaList); // Fetch for all miRNAs in the list
    if (mirnaList.length > 0) { // For graph, still show the first one
      await fetchGraphData(mirnaList[0], selectedHeuristics.value, mergeStrategy.value);
    }
    if (viewMode.value === 'graph' && mirnaList.length > 1) {
      console.warn("Multiple miRNAs processed. Graph view shows data for the first miRNA. Switch to Table View for combined results based on Multi-miRNA Heuristic Strategy.");
    }
  }

  isLoading.value = false;
  showOutput.value = true;

  const currentProcessedNodes = processedGraphNodes.value;
  const currentFilteredPredictions = filteredPredictions.value;
  const hasGraphNodes = currentProcessedNodes && typeof currentProcessedNodes === 'object' && Object.keys(currentProcessedNodes).length > 0;
  const hasTableData = currentFilteredPredictions && Array.isArray(currentFilteredPredictions) && currentFilteredPredictions.length > 0;

  if (searchMode.value === 'single' && mirnaList.length === 1 && hasGraphNodes) {
    viewMode.value = 'graph';
  } else if (hasTableData) { // This will be true if multi-miRNA heuristic yields results
    viewMode.value = 'table';
  } else if (mirnaList.length === 1 && searchMode.value === 'single') { // Fallback for single miRNA
    viewMode.value = 'graph';
  } else { // Default or multi-miRNA with no results from heuristic
    viewMode.value = 'table';
  }

  if (viewMode.value === 'graph' && graphViewDisabled.value) {
    viewMode.value = 'table';
  }
}

function toggleSearchModeAndCollapseTitle() {
  if (!hasTitleBeenCollapsedByAction.value && !isTitleCollapsed.value) {
    isTitleCollapsed.value = true;
    hasTitleBeenCollapsedByAction.value = true;
  }
  toggleSearchMode();
}

function toggleSearchMode() {
  searchMode.value = searchMode.value === 'single' ? 'multiple' : 'single';
}

function toggleViewMode() {
  if (graphViewDisabled.value && viewMode.value === 'table') {
    alert("Graph view is typically for single miRNA analysis. If multiple miRNAs were input, the graph shows data for the first one listed.");
  }
  viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph';
}
</script>

<style scoped>
.fill-height { height: 100%; }
.bio-bg { background: linear-gradient(135deg, #e0f7fa, #f0faee); position: relative; overflow: hidden; min-height: 100vh; }
.dna-bg::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; background-repeat: repeat; background-position: 0 0; background-size: 300px 800px; opacity: 0.12; animation: scrollBackground 40s linear infinite; background-image: url("data:image/svg+xml,%3Csvg width='300' height='800' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2388c0d0' stroke-width='3'%3E%3Cpath d='M150 0 C280 50, 20 150, 150 200 C280 250, 20 350, 150 400 C280 450, 20 550, 150 600 C280 650, 20 750, 150 800'/%3E%3C/g%3E%3Cg fill='%23cba8ff'%3E%3Ccircle cx='150' cy='50' r='4'/%3E%3Ccircle cx='150' cy='150' r='4'/%3E%3Ccircle cx='150' cy='250' r='4'/%3E%Ccircle cx='150' cy='350' r='4'/%3E%3Ccircle cx='150' cy='450' r='4'/%3E%3Ccircle cx='150' cy='550' r='4'/%3E%3Ccircle cx='150' cy='650' r='4'/%3E%3Ccircle cx='150' cy='750' r='4'/%3E%3C/g%3E%3C/svg%3E"); }
@keyframes scrollBackground { 0% { background-position: 0 0; } 100% { background-position: 0 800px; } }
.z-index-1 { z-index: 1; position: relative; }
.w-100 { width: 100%; }

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
  box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
  transition: opacity 0.2s ease-out;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
}
</style>