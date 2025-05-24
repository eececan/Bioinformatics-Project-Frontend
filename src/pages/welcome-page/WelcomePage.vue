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
            style="min-height:450px"
        >
          <v-form @submit.prevent="submitSearch">
            <div class="text-center mb-4 d-flex justify-space-between align-center">
              <h3 class="text-h6 font-weight-medium text-grey-darken-2">
                {{ searchMode === 'single' ? 'Single miRNA Search' : 'Multiple miRNAs Search' }}
              </h3>
              <v-tooltip location="bottom">
                <template #activator="{ props: tooltipProps }">
                  <v-chip
                      v-bind="tooltipProps"
                      @click="toggleSearchMode"
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
                <v-tooltip text="Select tools for target prediction.">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <v-select
                v-model="mergeStrategy"
                :items="strategies"
                label="Select Target Merge Strategy (for Tools)"
                outlined
                chips
                class="mb-4 mt-4"
            >
              <template #append>
                <v-tooltip text="'union' = all targets from selected tools, 'intersection' = targets common to ALL selected tools, 'at least two tools' = targets predicted by >= 2 selected tools. Affects Graph and Table.">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <!-- NEW FIELD: Select Heuristic Strategy (for multiple miRNAs) -->
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
                <v-tooltip text="'union' = show targets if any miRNA predicts them, 'intersection' = show targets ONLY if ALL miRNAs predict them, 'majority' = show targets if >50% of miRNAs predict them. (Affects Table View for multiple miRNAs)">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-account-group-outline</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>
            <!-- END OF NEW FIELD -->


            <div class="text-center">
              <v-btn type="submit" color="green darken-1" dark :loading="isLoading">
                <v-icon left>mdi-magnify</v-icon> Analyze
              </v-btn>
            </div>
          </v-form>
        </v-card>
      </v-col>

      <!-- ... Rest of your v-col for output display ... -->
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
                  <th>miRNA(s)</th> <!-- Changed label -->
                  <th>Tool(s)</th>
                  <th>Gene</th>
                  <th>Pathway(s)</th>
                </tr>
                </thead>
                <tbody>
                <!-- Modified loop for potentially grouped data -->
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
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
// ... (rest of your imports: axios, neo4j, v-network-graph, etc.)
import axios from 'axios';
import neo4j from 'neo4j-driver';
import { VNetworkGraph, defineConfigs } from "v-network-graph";
import { ForceLayout } from "v-network-graph/lib/force-layout";
import "v-network-graph/lib/style.css";


const mirnas = ref('');
const inputtedMirna = ref('');
const inputtedMirnaForDisplay = ref('');
const searchMode = ref('single'); // 'single' or 'multiple'

const selectedHeuristics = ref([]); // Tools like TargetScan, PicTar etc.
const mergeStrategy = ref('union(only for testing)'); // For how selectedHeuristics combine for ONE miRNA

// NEW: For multiple miRNA search mode
const heuristicStrategy = ref('union'); // How results from MULTIPLE miRNAs are combined for a gene
const heuristicStrategies = ['union', 'intersection', 'majority'];


const viewMode = ref('graph');
const showOutput = ref(false);
const isLoading = ref(false);
const graphDataKey = ref(0);

const rawPredictions = ref([]); // This will store an array of { mirna: 'name', gene: 'gene', tools: [], pathways: [] }
const graphData = ref({ nodes: [], relationships: [] });
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['union(only for testing)', 'intersection', 'at least two tools']; // For single miRNA tool merging
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

const graphViewDisabled = computed(() => {
  // Graph is generally for a single miRNA context.
  // If multiple miRNAs are in the input field, disable graph view or make it show the first.
  const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
  return mirnaList.length > 1 && searchMode.value === 'multiple'; // More specific: disable if in multi-mode and more than one miRNA
});

const graphConfigs = defineConfigs({ /* ... your existing graphConfigs ... */ });
const processedGraphNodes = computed(() => { /* ... your existing computed ... */ });
const processedGraphEdges = computed(() => { /* ... your existing computed ... */ });
const hoveredEdgeDetails = computed(() => { /* ... your existing computed ... */ });
watch([edgeTooltipOpacity, targetEdgeId, () => edgeTooltipRef.value], () => { /* ... */ }, {flush: 'post'});
const graphEventHandlers = { /* ... your existing graphEventHandlers ... */ };

async function fetchGraphData(mirnaNameToSearch, selectedToolsForGraph, mergeStrategyForGraph) {
  // This function remains focused on fetching data for a SINGLE miRNA for the graph.
  // The 'mergeStrategyForGraph' here refers to how tools are combined for that one miRNA.
  // The new 'heuristicStrategy' is for combining results from multiple miRNAs, primarily for the table.
  if (!driver) {
    console.error('Neo4j driver not available.');
    graphData.value = { nodes: [], relationships: [] };
    return;
  }
  let session;
  let cypherQuery = '';
  // Use mergeStrategyForGraph (which is the original mergeStrategy.value) for the graph query
  const params = { mirnaNameParam: mirnaNameToSearch, selectedToolsParam: selectedToolsForGraph };

  const baseMirnaMatch = `MATCH (mir:microRNA {name: $mirnaNameParam})`;
  const allDefaultToolTypes = `PicTar|RNA22|TargetScan|miRTarBase`;

  const pathwayAndReturnStructure = `
    OPTIONAL MATCH (target)-[r_path:PART_OF_PATHWAY]->(pathway:Pathway)
    RETURN mir, target, r_path, pathway,
      CASE
        WHEN target IS NOT NULL AND mir_target_tools_list IS NOT NULL
        THEN [tool_rel IN mir_target_tools_list WHERE tool_rel IS NOT NULL | type(tool_rel)]
        ELSE []
      END AS toolsForEdgeLabel
  `;

  if (mergeStrategyForGraph === 'union(only for testing)' || selectedToolsForGraph.length === 0) {
    const toolsToQuery = selectedToolsForGraph.length > 0 ? selectedToolsForGraph.join('|') : allDefaultToolTypes;
    cypherQuery = `
      ${baseMirnaMatch}
      OPTIONAL MATCH (mir)-[r_tool:${toolsToQuery}]->(target:Target)
      WITH mir, target, COLLECT(DISTINCT r_tool) AS mir_target_tools_list
      UNWIND (CASE WHEN target IS NULL THEN [null] ELSE [target] END) as current_target_node
      WITH mir, current_target_node as target, mir_target_tools_list
      ${pathwayAndReturnStructure}
    `;
  } else {
    const toolRelTypesString = selectedToolsForGraph.join('|');
    let qualifyingTargetsSubquery = '';

    if (mergeStrategyForGraph === 'intersection') {
      if (selectedToolsForGraph.length < 1) { /* ... alert ... */ return; }
      qualifyingTargetsSubquery = `
        WITH mir
        CALL {
            WITH mir
            MATCH (mir)-[r_int:${toolRelTypesString}]->(t_int:Target)
            WITH mir, t_int, COLLECT(DISTINCT type(r_int)) AS tools_for_target
            WHERE size(tools_for_target) = size($selectedToolsParam)
            AND ALL(selTool IN $selectedToolsParam WHERE selTool IN tools_for_target)
            RETURN COLLECT(DISTINCT t_int) AS qualifying_target_nodes_list
        }
        UNWIND (CASE WHEN size(qualifying_target_nodes_list) = 0 THEN [null] ELSE qualifying_target_nodes_list END) AS target
      `;
    } else if (mergeStrategyForGraph === 'at least two tools') {
      if (selectedToolsForGraph.length < 2) { /* ... alert ... */ return; }
      qualifyingTargetsSubquery = `
        WITH mir
        CALL {
            WITH mir
            MATCH (mir)-[r_scan:${toolRelTypesString}]->(t_scan:Target)
            WITH mir, t_scan, COLLECT(DISTINCT type(r_scan)) AS tools_found
            WHERE size(tools_found) >= 2
            RETURN COLLECT(DISTINCT t_scan) AS qualifying_target_nodes_list
        }
        UNWIND (CASE WHEN size(qualifying_target_nodes_list) = 0 THEN [null] ELSE qualifying_target_nodes_list END) AS target
      `;
    }
    cypherQuery = `
      ${baseMirnaMatch}
      ${qualifyingTargetsSubquery}
      WITH mir, target
      OPTIONAL MATCH (mir)-[r_qual_tool:${toolRelTypesString}]->(target)
      WITH mir, target, COLLECT(DISTINCT r_qual_tool) AS mir_target_tools_list
      ${pathwayAndReturnStructure}
    `;
  }
  // ... (rest of fetchGraphData: console logs, try/catch, data processing for graph)
  console.log("[Graph Cypher Debug] Strategy used (for tools on one miRNA):", mergeStrategyForGraph);
  // ... same try/catch/finally as before ...
  try {
    session = driver.session({ database: 'neo4j' });
    const result = await session.run(cypherQuery, params);
    const tempNodes = []; const tempRelationships = []; const seenNodeIds = new Set(); const seenRelationshipIds = new Set();
    result.records.forEach((record) => { /* ... existing node/rel processing ... */ });
    graphData.value = { nodes: tempNodes, relationships: tempRelationships };
  } catch (error) {
    console.error(`[DEBUG] fetchGraphData Error:`, error);
    graphData.value = { nodes: [], relationships: [] };
  } finally {
    if (session) await session.close();
  }
}


onMounted(() => { /* ... your existing onMounted ... */ });
onUnmounted(async () => { /* ... your existing onUnmounted ... */ });

async function fetchTableData(mirnaNameList) {
  console.log(`[Table Fetch] Requesting predictions for: ${mirnaNameList.join(', ')}`);
  let allIndividualPredictions = []; // Store predictions per miRNA before applying heuristicStrategy
  try {
    for (const mirnaName of mirnaNameList) {
      const response = await axios.get(`/api/mirna/predictions?name=${mirnaName}`); // Assuming this API gives gene, tools, pathways for ONE miRNA
      const predictionsFromApi = Array.isArray(response.data.predictions) ? response.data.predictions : [];

      if (predictionsFromApi.length > 0) {
        predictionsFromApi.forEach(pred => {
          const geneName = pred.gene_symbol || pred.gene || "N/A";
          // Apply the 'mergeStrategy' (for tools) at this individual miRNA level
          let toolsList = Array.isArray(pred.tools) ? pred.tools : [];
          let meetsToolMergeCriteria = true;

          if (selectedHeuristics.value.length > 0) { // Only apply tool merge if tools are selected
            const relevantTools = toolsList.filter(tool => selectedHeuristics.value.includes(tool));
            if (mergeStrategy.value === 'intersection') {
              meetsToolMergeCriteria = selectedHeuristics.value.every(st => relevantTools.includes(st));
            } else if (mergeStrategy.value === 'at least two tools') {
              meetsToolMergeCriteria = relevantTools.length >= 2;
            }
            // For 'union', any relevant tool is fine, so effectively meetsToolMergeCriteria remains true if relevantTools.length > 0
            // If no selectedHeuristics, all tools are considered "relevant" or this check is skipped.
            if (meetsToolMergeCriteria && relevantTools.length === 0 && selectedHeuristics.value.length > 0) {
              meetsToolMergeCriteria = false; // No selected tools found for this prediction
            }
            toolsList = relevantTools; // Show only selected tools that made it through
          }


          if (meetsToolMergeCriteria && toolsList.length > 0) { // Ensure there are tools after filtering
            const pathwaysList = Array.isArray(pred.pathways) && pred.pathways.length > 0 ? pred.pathways : ["N/A"];
            pathwaysList.forEach(pathway => { // Create an entry for each pathway
              allIndividualPredictions.push({
                mirna: mirnaName,
                gene: geneName,
                tools: toolsList, // Tools that met the single-miRNA mergeStrategy
                pathways: [pathway], // Keep pathways as single item array for now
              });
            });
          }
        });
      }
    }
    rawPredictions.value = allIndividualPredictions; // This is pre-multi-miRNA heuristic strategy
    console.log('[Table Fetch] rawPredictions.value (pre-multi-miRNA strategy):', JSON.parse(JSON.stringify(rawPredictions.value)));
  } catch (error) {
    console.error(`[Table Fetch] Error fetching table predictions for ${mirnaNameList.join(', ')}:`, error);
    rawPredictions.value = [];
  }
}

// This computed property will now also handle the new 'heuristicStrategy' for multiple miRNAs
const filteredPredictions = computed(() => {
  if (!rawPredictions.value || rawPredictions.value.length === 0) return [];

  let currentPredictions = JSON.parse(JSON.stringify(rawPredictions.value)); // Work with a copy

  // This part (filtering by selectedHeuristics and mergeStrategy) is now handled *within* fetchTableData
  // to determine which tools are associated with a gene for *each individual miRNA*.
  // The rawPredictions now reflect that.

  // If multiple miRNAs were searched, apply the multi-miRNA heuristicStrategy
  const mirnaListForFiltering = inputtedMirna.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (searchMode.value === 'multiple' && mirnaListForFiltering.length > 1) {
    const geneToMirnasMap = {}; // { geneX: { mirnas: ['mirA', 'mirB'], tools: Set(), pathways: Set() } }
    currentPredictions.forEach(p => {
      if (!geneToMirnasMap[p.gene]) {
        geneToMirnasMap[p.gene] = {
          mirnasInvolved: new Set(),
          allToolsForGene: new Set(), // Collect all tools that predicted this gene across miRNAs
          allPathwaysForGene: new Set() // Collect all pathways for this gene
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
          mirnasInvolved: Array.from(data.mirnasInvolved), // For display
          tools: Array.from(data.allToolsForGene), // Show all tools that predicted this gene from the qualifying miRNAs
          pathways: Array.from(data.allPathwaysForGene).length > 0 ? Array.from(data.allPathwaysForGene) : ["N/A"],
        });
      }
    }
    console.log(`[Filtered Table] Multi-miRNA strategy '${heuristicStrategy.value}' applied. Result:`, finalFiltered);
    return finalFiltered;
  } else {
    // For single miRNA search, or if only one miRNA was effectively processed
    // The rawPredictions are already structured per gene, pathway.
    // We just need to ensure it's in the right { gene, tools, pathways, mirna } format.
    console.log("[Filtered Table] Single miRNA mode or fallback. Result:", currentPredictions);
    return currentPredictions.map(p => ({
      ...p, // contains mirna, gene, tools, pathways (as single item array)
      pathways: p.pathways.length > 0 ? p.pathways : ["N/A"] // ensure "N/A" if empty
    }));
  }
});


async function submitSearch() {
  isLoading.value = true;
  showOutput.value = false;
  graphDataKey.value++;
  rawPredictions.value = []; // Clear previous raw predictions
  graphData.value = {nodes: [], relationships: []};

  const currentMirnasInput = mirnas.value;
  const mirnaList = currentMirnasInput.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  if (mirnaList.length === 0) {
    alert('Please enter at least one miRNA.');
    isLoading.value = false;
    return;
  }

  inputtedMirna.value = mirnaList.join(', '); // Store all inputted miRNAs for reference

  if (searchMode.value === 'single') {
    if (mirnaList.length > 1) {
      alert('Single miRNA Search mode: Please enter only one miRNA. Processing the first miRNA entered.');
    }
    const singleMirnaToProcess = mirnaList[0];
    inputtedMirnaForDisplay.value = singleMirnaToProcess;
    await Promise.all([
      fetchTableData([singleMirnaToProcess]), // fetchTableData expects an array
      // For graph, use the 'mergeStrategy' (for tools)
      fetchGraphData(singleMirnaToProcess, selectedHeuristics.value, mergeStrategy.value)
    ]);
  } else { // Multiple miRNAs Search mode
    inputtedMirnaForDisplay.value = mirnaList.length > 1 ? `Multiple miRNAs (${mirnaList.length})` : mirnaList[0];
    // Table data will be fetched for all, then filtered by 'heuristicStrategy' in computed prop
    await fetchTableData(mirnaList);
    if (mirnaList.length > 0) {
      // Graph will show data for the first miRNA in the list, using 'mergeStrategy' (for tools)
      await fetchGraphData(mirnaList[0], selectedHeuristics.value, mergeStrategy.value);
    }
    if (viewMode.value === 'graph' && mirnaList.length > 1) {
      console.warn("Multiple miRNAs processed. Graph view shows data for the first miRNA. Switch to Table View for combined results based on Multi-miRNA Heuristic Strategy.");
    }
  }

  isLoading.value = false;
  showOutput.value = true;

  // Determine default view mode
  if (searchMode.value === 'single' && mirnaList.length === 1 && Object.keys(processedGraphNodes.value).length > 0) {
    viewMode.value = 'graph';
  } else if (filteredPredictions.value.length > 0) { // Check filtered (which now considers heuristicStrategy)
    viewMode.value = 'table';
  } else if (mirnaList.length === 1) { // Fallback if single was searched but no table data
    viewMode.value = 'graph';
  } else {
    viewMode.value = 'table';
  }

  // If graph view is active but should be disabled (e.g. multi-mode and >1 miRNA), switch to table.
  if (viewMode.value === 'graph' && graphViewDisabled.value) {
    viewMode.value = 'table';
  }
}

function toggleSearchMode() {
  searchMode.value = searchMode.value === 'single' ? 'multiple' : 'single';
  if (searchMode.value === 'single') {
    // If switching to single, and multiple miRNAs are in the input,
    // you might want to clear it or take the first one.
    // const mirnaList = mirnas.value.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
    // if (mirnaList.length > 1) mirnas.value = mirnaList[0];
  }
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
.bio-bg { background: linear-gradient(135deg, #eafdff, #f0faee); position: relative; overflow: hidden; min-height: 100vh; }
.dna-bg::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; background-repeat: repeat; background-position: 0 0; background-size: 300px 800px; opacity: 0.1; animation: scrollBackground 40s linear infinite; background-image: url("data:image/svg+xml,%3Csvg width='300' height='800' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2388c0d0' stroke-width='3'%3E%3Cpath d='M150 0 C280 50, 20 150, 150 200 C280 250, 20 350, 150 400 C280 450, 20 550, 150 600 C280 650, 20 750, 150 800'/%3E%3C/g%3E%3Cg fill='%23cba8ff'%3E%3Ccircle cx='150' cy='50' r='4'/%3E%3Ccircle cx='150' cy='150' r='4'/%3E%3Ccircle cx='150' cy='250' r='4'/%3E%3Ccircle cx='150' cy='350' r='4'/%3E%3Ccircle cx='150' cy='450' r='4'/%3E%3Ccircle cx='150' cy='550' r='4'/%3E%3Ccircle cx='150' cy='650' r='4'/%3E%3Ccircle cx='150' cy='750' r='4'/%3E%3C/g%3E%3C/svg%3E"); }
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
.cursor-pointer {
  cursor: pointer;
}
</style>