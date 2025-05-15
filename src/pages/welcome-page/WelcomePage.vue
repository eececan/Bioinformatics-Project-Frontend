<template>
  <v-container fluid class="pa-10 bio-bg text-grey-darken-4">
    <div class="dna-bg"></div>

    <div class="text-center mb-8 position-relative z-index-1">
      <v-icon size="64" color="green darken-2">mdi-dna</v-icon>
      <h1 class="text-h4 font-weight-bold mt-2">miRNA Target Gene & Pathway Analyzer</h1>
      <h2 class="subtitle-1 text-grey mt-1 mb-12">
        Analyze miRNA interactions, predicted target genes, and affected pathways
      </h2>
    </div>
    <v-row justify="center" class="z-index-1 position-relative">
      <v-col cols="12" md="6" lg="5">
        <v-card
            class="pa-6 rounded-lg elevation-10 d-flex flex-column justify-center"
            style="height:450px"
        >
          <v-form @submit.prevent="submitSearch">
            <div class="text-center mb-4">
              <h3 class="text-h6 font-weight-medium text-grey-darken-2">Input Parameters</h3>
            </div>
            <v-textarea
                v-model="mirnas"
                label="Enter miRNA(s)"
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
                  <span>Separate with commas or newlines (Graph view supports single miRNA)</span>
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
                <v-tooltip text="Select prediction tools (affects Table View)">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <v-select
                v-model="mergeStrategy"
                :items="strategies"
                label="Select Merge Strategy"
                outlined
                chips
                class="mb-4 mt-4"
            >
              <template #append>
                <v-tooltip text="'union' = all results, 'intersection' = common targets, 'at least two tools' = targets predicted by at least two tools (affects Table View)">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon>
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
          <p class="mt-4 text-subtitle-2 text-grey">Loading data for {{ inputtedMirna }}...</p>
        </div>

        <div v-if="showOutput && !isLoading" class="w-100">
          <div class="d-flex justify-end mb-2">
            <v-btn
                color="green darken-1"
                @click="toggleViewMode"
                small
                dark
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
            <template v-if="Object.keys(processedGraphNodes).length > 0 && !isLoading">
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
              <span>No graph data found for "{{ inputtedMirna }}" from Neo4j.</span>
              <span class="text-caption mt-1">Try searching for a specific miRNA (e.g., "mmu-let-7a-5p").</span>
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
                  <th>miRNA</th>
                  <th>Tool(s)</th>
                  <th>Gene</th>
                  <th>Pathway(s)</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(prediction, index) in filteredPredictions" :key="`${inputtedMirna}-${prediction.gene}-${index}`">
                  <td>{{ inputtedMirna }}</td>
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
              <p class="text-subtitle-1">No table predictions found for "{{ inputtedMirna }}" based on the selected criteria.</p>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>
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
const inputtedMirna = ref('');
const selectedHeuristics = ref([]);
const mergeStrategy = ref('union');
const viewMode = ref('graph');
const showOutput = ref(false);
const isLoading = ref(false);
const graphDataKey = ref(0);

// --- Data ---
const rawPredictions = ref([]);
const graphData = ref({ nodes: [], relationships: [] });

// --- Constants ---
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['union', 'intersection', 'at least two tools'];

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
const edgeTooltipPos = ref({ left: "0px", top: "0px" });
const mousePosition = ref({ x: 0, y: 0 });

const graphConfigs = defineConfigs({
  view: {
    layoutHandler: new ForceLayout({
      positionFixedByDrag: false,
      positionFixedByClickWithAltKey: true,
      simulationTime: 2500, // Slightly increased simulation time
      createSimulation: (d3, nodes, edges) => {
        const forceLink = d3.forceLink(edges).id(d => d.id).distance(150).strength(0.5); // Increased distance
        return d3.forceSimulation(nodes)
            .force("edge", forceLink)
            .force("charge", d3.forceManyBody().strength(-1200)) // Increased repulsion
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
    normal: {width: 2, color: "red"},
    hover: {width: 3, color: "darkred"},
    selected: {width: 3, color: "orange"},
    label: { visible: false },
    gap: 15,
    marker: {
      target: {type: "arrow", width: 5, height: 5, margin: -2.5, units: "strokeWidth", color: "red"}
    }
  },
});

const processedGraphNodes = computed(() => {
  const nodesObject = {};
  if (graphData.value.nodes) {
    for (const node of graphData.value.nodes) {
      const nodeId = String(node.id);
      nodesObject[nodeId] = { name: node.label, radius: node.type === 'microRNA' ? 16 : (node.type === 'Pathway' ? 10 : 8), color: node.type === 'microRNA' ? '#03A9F4' : (node.type === 'Pathway' ? '#FF5722' : '#4CAF50'), };
    }
  }
  return nodesObject;
});
const processedGraphEdges = computed(() => {
  const edgesObject = {};
  if (graphData.value.relationships) {
    for (const rel of graphData.value.relationships) {
      const edgeId = String(rel.id);
      edgesObject[edgeId] = { source: String(rel.source), target: String(rel.target), name: rel.label };
    }
  }
  return edgesObject;
});

const hoveredEdgeDetails = computed(() => {
  if (!targetEdgeId.value || !processedGraphEdges.value[targetEdgeId.value]) {
    return null;
  }
  return processedGraphEdges.value[targetEdgeId.value];
});

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
      edgeTooltipPos.value = { left: left + "px", top: top + "px" };
    },
    {flush: 'post'}
);

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

// In <script setup>

async function fetchGraphData(mirnaNameToSearch, selectedTools, strategy) {
  if (!driver) { console.error('Neo4j driver not available.'); graphData.value = { nodes: [], relationships: [] }; return; }
  let session;
  let cypherQuery = '';
  const params = { mirnaNameParam: mirnaNameToSearch, selectedToolsParam: selectedTools };

  try {
    session = driver.session({ database: 'neo4j' });
    const tempNodes = []; const tempRelationships = [];
    const seenNodeIds = new Set(); const seenRelationshipIds = new Set();

    console.log(`[DEBUG] fetchGraphData: miRNA: "${mirnaNameToSearch}", Tools: ${selectedTools.join(', ')}, Strategy: ${strategy}`);

    const baseMirnaMatch = `MATCH (mir:microRNA {name: $mirnaNameParam}) `;
    // We always want to return mir, target, pathway, and the tools involved in the mir-target link
    const returnClause = `RETURN mir, target, r_path, pathway,
                          // toolsForEdge will be a list of actual tool types connecting mir to target
                          CASE WHEN target IS NOT NULL THEN [rel IN mir_target_rels WHERE startNode(rel)=mir AND endNode(rel)=target | type(rel)] ELSE [] END AS toolsForEdgeLabel`;
    const optionalPathwayMatch = `OPTIONAL MATCH (target)-[r_path:PART_OF_PATHWAY]->(pathway:Pathway) `;
    const allDefaultToolTypes = `PicTar|RNA22|TargetScan|miRTarBase`; // For when no tools are selected

    if (selectedTools.length === 0 || strategy === 'union') {
      // If no tools selected, or union strategy, show all connections by selected (or default) tools
      const toolsToMatch = selectedTools.length > 0 ? selectedTools.join('|') : allDefaultToolTypes;
      cypherQuery = `
        ${baseMirnaMatch}
        OPTIONAL MATCH (mir)-[r_tool:${toolsToMatch}]->(target:Target)
        // Collect all relationships between this specific mir and target to pass to RETURN
        WITH mir, target, COLLECT(DISTINCT r_tool) AS mir_target_rels
        UNWIND (CASE WHEN target IS NULL THEN [null] ELSE mir_target_rels END) AS r_tool_instance
        // r_tool_instance will be null if target is null, or one of the relations if target exists
        // This UNWIND ensures we process pathways even if r_tool_instance is null (target exists but no tool rels under current filter)
        // OR if target itself is null initially (no targets at all)
        ${optionalPathwayMatch}
        // Re-collect for the return clause to handle multiple pathways per target
        WITH mir, target, r_tool_instance, COLLECT(DISTINCT r_path) AS r_paths, COLLECT(DISTINCT pathway) AS pathways_coll, mir_target_rels
        UNWIND (CASE WHEN size(r_paths) = 0 THEN [null] ELSE r_paths END) AS r_path
        UNWIND (CASE WHEN size(pathways_coll) = 0 THEN [null] ELSE pathways_coll END) AS pathway
        ${returnClause.replace('r_tool','r_tool_instance')}
      `;
    } else { // Intersection or At least two tools
      const toolRelTypesString = selectedTools.join('|');
      let qualifyingTargetsSubquery = '';

      if (strategy === 'intersection') {
        if (selectedTools.length < 1) { alert("Intersection strategy requires at least one tool."); graphData.value = {nodes:[], relationships:[]}; return; }
        qualifyingTargetsSubquery = `
          CALL {
              WITH mir
              MATCH (mir)-[r_int:${toolRelTypesString}]->(t_int:Target)
              WITH mir, t_int, COLLECT(DISTINCT type(r_int)) AS tools_for_target
              WHERE size(tools_for_target) = size($selectedToolsParam) // All selected tools must be present
              RETURN COLLECT(DISTINCT t_int) AS qualifyingTargetNodes // Return a list of nodes
          }
          UNWIND qualifyingTargetNodes AS target // Unwind to process each qualifying target
        `;
      } else if (strategy === 'at least two tools') {
        if (selectedTools.length < 2) { alert("'At least two tools' strategy requires selecting at least two tools."); graphData.value = {nodes:[], relationships:[]}; return; }
        qualifyingTargetsSubquery = `
          CALL {
              WITH mir
              MATCH (mir)-[r_scan:${toolRelTypesString}]->(t_scan:Target)
              WITH mir, t_scan, COLLECT(DISTINCT type(r_scan)) AS tools_found
              WHERE size(tools_found) >= 2
              RETURN COLLECT(DISTINCT t_scan) AS qualifyingTargetNodes
          }
          UNWIND qualifyingTargetNodes AS target
        `;
      }

      // Main query for these strategies
      cypherQuery = `
        ${baseMirnaMatch}
        ${qualifyingTargetsSubquery} // This defines 'target'
        // Now that 'target' is defined as a qualifying node, get all relationships (of selected types) between mir and this target
        WITH mir, target
        OPTIONAL MATCH (mir)-[r_qual_tool:${toolRelTypesString}]->(target)
        WITH mir, target, COLLECT(DISTINCT r_qual_tool) AS mir_target_rels // These are the actual predicting relationships
        UNWIND (CASE WHEN target IS NULL THEN [null] ELSE mir_target_rels END) AS r_tool_instance
        ${optionalPathwayMatch}
        WITH mir, target, r_tool_instance, COLLECT(DISTINCT r_path) AS r_paths, COLLECT(DISTINCT pathway) AS pathways_coll, mir_target_rels
        UNWIND (CASE WHEN size(r_paths) = 0 THEN [null] ELSE r_paths END) AS r_path
        UNWIND (CASE WHEN size(pathways_coll) = 0 THEN [null] ELSE pathways_coll END) AS pathway
        ${returnClause.replace('r_tool','r_tool_instance')}
      `;
    }

    console.log("-----------------------------------");
    console.log("[Cypher Debug] Strategy:", strategy);
    console.log("[Cypher Debug] Generated Cypher Query:\n", cypherQuery);
    console.log("[Cypher Debug] Query Parameters:\n", JSON.stringify(params, null, 2));
    console.log("-----------------------------------");

    const result = await session.run(cypherQuery, params);
    console.log(`[DEBUG] fetchGraphData: Neo4j query returned ${result.records.length} records.`);

    // Temporary map to group pathways by mir-target pairs for "intersection" and "at least two"
    const mirTargetToPathways = new Map();

    result.records.forEach((record) => {
      const mirnaNodeData = record.get('mir');
      const targetNodeData = record.get('target');
      const pathwayRel = record.get('r_path'); // This is r_path from the record
      const pathwayNodeData = record.get('pathway');
      const toolsForEdge = record.get('toolsForEdgeLabel'); // List of tool names

      // Add miRNA node
      if (mirnaNodeData && mirnaNodeData.elementId && !seenNodeIds.has(mirnaNodeData.elementId)) {
        tempNodes.push({ id: mirnaNodeData.elementId, label: mirnaNodeData.properties.name || 'miRNA', properties: mirnaNodeData.properties, type: mirnaNodeData.labels[0] || 'microRNA' });
        seenNodeIds.add(mirnaNodeData.elementId);
      }

      // Add Target node (if it exists in this record)
      if (targetNodeData && targetNodeData.elementId && !seenNodeIds.has(targetNodeData.elementId)) {
        tempNodes.push({ id: targetNodeData.elementId, label: targetNodeData.properties.name || 'Target', properties: targetNodeData.properties, type: targetNodeData.labels[0] || 'Target' });
        seenNodeIds.add(targetNodeData.elementId);
      }

      // Add Pathway node (if it exists in this record)
      if (pathwayNodeData && pathwayNodeData.elementId && !seenNodeIds.has(pathwayNodeData.elementId)) {
        tempNodes.push({ id: pathwayNodeData.elementId, label: pathwayNodeData.properties.name || 'Pathway', properties: pathwayNodeData.properties, type: pathwayNodeData.labels[0] || 'Pathway' });
        seenNodeIds.add(pathwayNodeData.elementId);
      }

      // Create miRNA-Target edge (summary edge for intersection/at_least_two, individual for union/no_tools)
      if (mirnaNodeData && targetNodeData && toolsForEdge && toolsForEdge.length > 0) {
        // For intersection/at_least_two, we want ONE edge summarizing all tools.
        // For union/no_tools, toolsForEdge will contain only one tool per record path, so this still works
        // to create distinct edges if the Cypher returns distinct r_tool_instance.
        // However, the modified Cypher for union/no_tools might group them already.
        // Let's ensure a unique conceptual edge per mir-target pair IF we intend to show only one.
        // The label will be the list of tools.
        const mirTargetEdgeId = `edge-${mirnaNodeData.elementId}-to-${targetNodeData.elementId}`;
        if (!seenRelationshipIds.has(mirTargetEdgeId)) {
          if (seenNodeIds.has(mirnaNodeData.elementId) && seenNodeIds.has(targetNodeData.elementId)) {
            tempRelationships.push({
              id: mirTargetEdgeId,
              source: mirnaNodeData.elementId,
              target: targetNodeData.elementId,
              label: toolsForEdge.join(', '), // Tooltip will show this
            });
            seenRelationshipIds.add(mirTargetEdgeId);
          }
        }
      }

      // Create Target-Pathway edge (always shown if target and pathway exist for this record)
      if (targetNodeData && pathwayNodeData && pathwayRel && pathwayRel.elementId) {
        if (!seenRelationshipIds.has(pathwayRel.elementId)) {
          if (seenNodeIds.has(targetNodeData.elementId) && seenNodeIds.has(pathwayNodeData.elementId)) {
            tempRelationships.push({
              id: pathwayRel.elementId,
              source: targetNodeData.elementId, // Corrected: source should be targetNodeData.elementId
              target: pathwayNodeData.elementId,
              label: "PART_OF_PATHWAY", // Or type(pathwayRel) if preferred
            });
            seenRelationshipIds.add(pathwayRel.elementId);
          }
        }
      }
    });

    if (tempNodes.length > 0) { // Only create graph if there are any nodes
      graphData.value = { nodes: tempNodes, relationships: tempRelationships };
    } else {
      graphData.value = { nodes: [], relationships: [] };
      // Logging for no data...
    }

  } catch (error) {
    console.error(`[DEBUG] fetchGraphData: Error for ${mirnaNameToSearch} with strategy ${strategy}:`, error);
    console.error("Failed Cypher Query that caused error (if available):\n", cypherQuery);
    console.error("Parameters for failed query (if available):", params);
    graphData.value = { nodes: [], relationships: [] };
  } finally {
    if (session) {
      console.log("[DEBUG] Closing Neo4j session in finally block.");
      await session.close();
    }
  }
}
// --- submitSearch, onMounted, onUnmounted, fetchTableData, filteredPredictions, toggleViewMode remain the same ---
onMounted(() => { try { driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)); driver.verifyConnectivity().then(() => console.log('Neo4j driver connected.')).catch(err => console.error('Neo4j connect error:', err)); } catch (e) { console.error('Neo4j init error:', e); } });
onUnmounted(async () => { if (driver) await driver.close().then(()=> console.log('Neo4j driver closed.')); });
async function fetchTableData(mirnaName) { console.log(`[Table Fetch] Requesting predictions for: ${mirnaName}`); try { const response = await axios.get(`/api/mirna/predictions?name=${mirnaName}`); console.log('[Table Fetch] API Response Data:', JSON.parse(JSON.stringify(response.data))); const predictionsFromApi = Array.isArray(response.data.predictions) ? response.data.predictions : []; console.log('[Table Fetch] predictionsFromApi:', JSON.parse(JSON.stringify(predictionsFromApi))); if (predictionsFromApi.length > 0) { rawPredictions.value = predictionsFromApi.flatMap(pred => { const geneName = pred.gene_symbol || pred.gene || "N/A"; const toolsList = Array.isArray(pred.tools) ? pred.tools : []; const pathwaysList = Array.isArray(pred.pathways) && pred.pathways.length > 0 ? pred.pathways : ["N/A"]; return pathwaysList.map(pathway => ({ gene: geneName, tools: toolsList, pathways: [pathway], })); }); } else { rawPredictions.value = []; } console.log('[Table Fetch] rawPredictions.value after processing:', JSON.parse(JSON.stringify(rawPredictions.value))); } catch (error) { console.error(`[Table Fetch] Error fetching table predictions for ${mirnaName}:`, error); rawPredictions.value = []; } }
const filteredPredictions = computed(() => { if (!rawPredictions.value || rawPredictions.value.length === 0) return []; let filtered = rawPredictions.value; if (selectedHeuristics.value.length > 0) { filtered = filtered.filter(prediction => prediction.tools && prediction.tools.some(tool => selectedHeuristics.value.includes(tool)) ); } if (selectedHeuristics.value.length > 0) { if (mergeStrategy.value === 'intersection') { filtered = filtered.filter(prediction => prediction.tools && selectedHeuristics.value.every(tool => prediction.tools.includes(tool)) ); } else if (mergeStrategy.value === 'at least two tools') { filtered = filtered.filter(prediction => prediction.tools && prediction.tools.filter(tool => selectedHeuristics.value.includes(tool)).length >= 2 ); } } return filtered; });
async function submitSearch() { isLoading.value = true; showOutput.value = false; graphDataKey.value++; rawPredictions.value = []; graphData.value = {nodes: [], relationships: []}; const currentMirnasInput = mirnas.value; const mirnaList = currentMirnasInput.split(/[\n,]+/).map(m => m.trim()).filter(Boolean); inputtedMirna.value = mirnaList.join(', ') || "N/A"; if (mirnaList.length === 1) { const singleMirna = mirnaList[0]; inputtedMirna.value = singleMirna; await Promise.all([ fetchTableData(singleMirna), fetchGraphData(singleMirna, selectedHeuristics.value, mergeStrategy.value) ]); } else if (mirnaList.length > 1) { alert('Multiple miRNAs entered. Graph view supports single miRNA only. Table view will attempt to load data for the first miRNA listed if available.'); if (mirnaList.length > 0) await fetchTableData(mirnaList[0]); viewMode.value = 'table'; } else { alert('Please enter at least one miRNA.'); } isLoading.value = false; showOutput.value = true; if (mirnaList.length === 1 && Object.keys(processedGraphNodes.value).length > 0) { viewMode.value = 'graph'; } else if (filteredPredictions.value.length > 0) { viewMode.value = 'table'; } else if (mirnaList.length === 1) { viewMode.value = 'graph'; } else { viewMode.value = 'table'; } }
function toggleViewMode() { viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph'; }

</script>

<style scoped>
/* Styles remain the same */
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