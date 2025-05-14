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

    <v-row justify="center" class="z-index-1 position-relative mt-5">
      <v-col cols="12" md="6" lg="5">
        <v-card class="pa-6 rounded-lg elevation-10" style="height:450px">
          <v-form @submit.prevent="submitSearch">
            <v-textarea
                v-model="mirnas"
                label="Enter miRNA(s)"
                auto-grow
                rows="1"
                outlined
                hint="Separate with commas or newlines (Graph view supports single miRNA)"
                persistent-hint
                class="mb-4"
            />

            <v-select
                v-model="selectedHeuristics"
                :items="heuristics"
                label="Select Heuristics (for Table View)"
                multiple
                chips
                outlined
                class="mb-2"
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
                label="Merge Strategy (for Table View)"
                outlined
                chips
                class="mb-4"
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
              id="network-visualization-container"
              class="pa-4 elevation-2 rounded-lg"
              style="width: 100%; height: 400px; background-color: #f0f2f5; border: 1px solid #ccc; overflow: hidden;"
          >
            <v-network-graph
                v-if="Object.keys(processedGraphNodes).length"
                :key="graphDataKey"
                :nodes="processedGraphNodes"
                :edges="processedGraphEdges"
                :layouts="graphLayouts"
                :configs="graphConfigs"
                class="graph-bg"
                style="width: 100%; height: 100%;"
            />
            <div v-else-if="isLoading" class="d-flex justify-center align-center fill-height">
              <v-progress-circular indeterminate color="green darken-1" size="50"></v-progress-circular>
            </div>
            <p v-else class="text-center text-grey-darken-2 mt-10 d-flex flex-column justify-center align-center fill-height">
              <span>No graph data found for "{{ inputtedMirna }}" from Neo4j.</span>
              <span class="text-caption mt-1">Try searching for a specific miRNA (e.g., "mmu-let-7a-5p").</span>
            </p>
          </div>

          <div
              v-else-if="viewMode === 'table'"
              class="pa-4 elevation-2 rounded-lg"
              style="width: 100%; height: 420px; background-color: #ffffff; border: 1px solid #ccc; overflow-y: auto;"
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
                <tr v-for="(prediction, index) in filteredPredictions" :key="index">
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
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import { VNetworkGraph, defineConfigs } from "v-network-graph";
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
const graphData = ref({ nodes: [], relationships: [] }); // Raw data from Neo4j (arrays)

// --- Constants ---
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['union', 'intersection', 'at least two tools'];

// --- Neo4j Driver Setup ---
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASSWORD = 'test1234';
let driver;

const graphLayouts = reactive({
  nodes: {}, // For dynamic graph, let v-network-graph auto-layout
});

const graphConfigs = defineConfigs({
  view: {
    zoomEnabled: true,
    panEnabled: true,
    autoPanAndZoomOnLoad: "center-content",
    fitContentMargin: "10%"
  },
  node: {
    selectable: true,
    hoverable: true,
    label: {
      visible: true,
      fontFamily: "Roboto, sans-serif",
      fontSize: 10,
      color: "#333333",
      margin: 4,
      direction: "south",
    },
    normal: { // These can now directly access properties if defined on the node value
      radius: node => node.radius || 8, // Assuming 'radius' is a property on the node value
      color: node => node.color || "#88c0d0",   // Assuming 'color' is a property on the node value
    },
    hover: {
      radius: node => (node.radius || 8) + 2,
    },
    selected: {
      strokeWidth: 2,
      strokeColor: "#EAB308"
    }
  },
  edge: {
    selectable: true,
    hoverable: true,
    normal: { width: 2, color: "red" },
    hover: { width: 3, color: "darkred" },
    selected: { width: 3, color: "orange" },
    label: {
      visible: true,
      text: "name",
      fontSize: 10,
      fontFamily: "Roboto, sans-serif",
      color: "black",
      background: {
        visible: true,
        color: "rgba(255, 255, 255, 0.7)",
        padding: {vertical: 1, horizontal: 3},
        borderRadius: 3
      }
    },
    gap: 15,
    marker: {
      target: {
        type: "arrow",
        width: 5, height: 5,
        margin: -2.5, units: "strokeWidth",
        color: "red",
      },
    },
  },
});

// MODIFIED: processedGraphNodes returns an OBJECT
const processedGraphNodes = computed(() => {
  const nodesObject = {};
  if (graphData.value.nodes) {
    for (const node of graphData.value.nodes) {
      const nodeId = String(node.id);
      nodesObject[nodeId] = {
        name: node.label,
        // Pass through specific properties for styling if defined on original node
        radius: node.type === 'microRNA' ? 12 : (node.type === 'Pathway' ? 10 : 8),
        color: node.type === 'microRNA' ? '#03A9F4' : (node.type === 'Pathway' ? '#FF5722' : '#4CAF50'),
        // Original properties for potential future use (e.g. tooltips)
        // _properties: node.properties,
        // _type: node.type
      };
    }
  }
  return nodesObject;
});

// MODIFIED: processedGraphEdges returns an OBJECT
const processedGraphEdges = computed(() => {
  const edgesObject = {};
  if (graphData.value.relationships) {
    for (const rel of graphData.value.relationships) {
      const edgeId = String(rel.id);
      edgesObject[edgeId] = {
        source: String(rel.source),
        target: String(rel.target),
        name: rel.label, // For edge label
        // _properties: rel.properties // Original properties
      };
    }
  }
  return edgesObject;
});

onMounted(() => {
  try {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    driver.verifyConnectivity()
        .then(() => console.log('Neo4j driver connected and verified.'))
        .catch(error => console.error('Neo4j driver verification failed:', error));
  } catch (error) {
    console.error('Failed to initialize Neo4j driver:', error);
  }
});

onUnmounted(async () => {
  if (driver) {
    try {
      await driver.close();
      console.log('Neo4j driver closed.');
    } catch (error) {
      console.error('Error closing Neo4j driver:', error);
    }
  }
});

async function fetchTableData(mirnaName) {
  try {
    const response = await axios.get(`http://localhost:8080/api/mirna/predictions?name=${mirnaName}`);
    const predictionsArray = Array.isArray(response.data.predictions) ? response.data.predictions : [];
    rawPredictions.value = predictionsArray.flatMap(pred =>
        (pred.pathways && pred.pathways.length > 0 ? pred.pathways : ["N/A"]).map(pathway => ({
          gene: pred.gene_symbol || pred.gene || "N/A",
          tools: pred.tools || [],
          pathways: [pathway],
        }))
    );
    if (!rawPredictions.value.length) {
      console.log(`Table: No predictions found for ${mirnaName} or data format issue.`);
    }
  } catch (error) {
    console.error(`Error fetching table predictions for ${mirnaName}:`, error);
    rawPredictions.value = [];
  }
}

async function fetchGraphData(mirnaNameToSearch) {
  if (!driver) {
    console.error('Neo4j driver not available.');
    graphData.value = {nodes: [], relationships: []};
    return;
  }
  const session = driver.session({database: 'neo4j'});
  const tempNodes = []; // Keep as array from Neo4j
  const tempRelationships = []; // Keep as array from Neo4j
  const seenNodeIds = new Set();
  const seenRelationshipIds = new Set();

  console.log(`[DEBUG] fetchGraphData: Starting search for miRNA: "${mirnaNameToSearch}"`);
  try {
    const result = await session.run(
        `MATCH (mir:microRNA {name: $mirnaNameParam})
       OPTIONAL MATCH (mir)-[r_tool:PicTar|RNA22|TargetScan|miRTarBase]->(target:Target)
       OPTIONAL MATCH (target)-[r_path:PART_OF_PATHWAY]->(pathway:Pathway)
       RETURN mir, r_tool, target, r_path, pathway`,
        {mirnaNameParam: mirnaNameToSearch}
    );
    console.log(`[DEBUG] fetchGraphData: Neo4j query returned ${result.records.length} records.`);

    result.records.forEach((record) => {
      const mirnaNodeData = record.get('mir');
      const toolRel = record.get('r_tool');
      const targetNodeData = record.get('target');
      const pathwayRel = record.get('r_path');
      const pathwayNodeData = record.get('pathway');

      if (mirnaNodeData && mirnaNodeData.elementId && !seenNodeIds.has(mirnaNodeData.elementId)) {
        tempNodes.push({
          id: mirnaNodeData.elementId,
          label: mirnaNodeData.properties.name || mirnaNodeData.properties.accession || 'miRNA',
          properties: mirnaNodeData.properties,
          type: mirnaNodeData.labels[0] || 'microRNA',
        });
        seenNodeIds.add(mirnaNodeData.elementId);
      }
      if (targetNodeData && targetNodeData.elementId && !seenNodeIds.has(targetNodeData.elementId)) {
        tempNodes.push({
          id: targetNodeData.elementId,
          label: targetNodeData.properties.name || targetNodeData.properties.ens_code || 'Target',
          properties: targetNodeData.properties,
          type: targetNodeData.labels[0] || 'Target',
        });
        seenNodeIds.add(targetNodeData.elementId);
      }
      if (pathwayNodeData && pathwayNodeData.elementId && !seenNodeIds.has(pathwayNodeData.elementId)) {
        tempNodes.push({
          id: pathwayNodeData.elementId,
          label: pathwayNodeData.properties.name || pathwayNodeData.properties.id || 'Pathway',
          properties: pathwayNodeData.properties,
          type: pathwayNodeData.labels[0] || 'Pathway',
        });
        seenNodeIds.add(pathwayNodeData.elementId);
      }

      if (toolRel && toolRel.elementId && !seenRelationshipIds.has(toolRel.elementId)) {
        // Check if source and target nodes for this rel were actually added
        if (seenNodeIds.has(toolRel.startNodeElementId) && seenNodeIds.has(toolRel.endNodeElementId)) {
          tempRelationships.push({
            id: toolRel.elementId,
            source: toolRel.startNodeElementId,
            target: toolRel.endNodeElementId,
            label: toolRel.type,
            properties: toolRel.properties,
          });
          seenRelationshipIds.add(toolRel.elementId);
        }
      }
      if (pathwayRel && pathwayRel.elementId && !seenRelationshipIds.has(pathwayRel.elementId)) {
        if (seenNodeIds.has(pathwayRel.startNodeElementId) && seenNodeIds.has(pathwayRel.endNodeElementId)) {
          tempRelationships.push({
            id: pathwayRel.elementId,
            source: pathwayRel.startNodeElementId,
            target: pathwayRel.endNodeElementId,
            label: pathwayRel.type,
            properties: pathwayRel.properties,
          });
          seenRelationshipIds.add(pathwayRel.elementId);
        }
      }
    });
    // Now assign the collected arrays to graphData.value
    // The computed properties (processedGraphNodes/Edges) will convert them to objects
    if (tempNodes.length > 0 || tempRelationships.length > 0) {
      graphData.value = {nodes: tempNodes, relationships: tempRelationships};
    } else {
      graphData.value = {nodes: [], relationships: []}; // Ensure it's reset
      if (result.records.length === 0) console.log(`[DEBUG] fetchGraphData: miRNA "${mirnaNameToSearch}" not found (0 records).`);
      else console.warn(`[DEBUG] fetchGraphData: No valid graph data constructed for "${mirnaNameToSearch}".`);
    }

  } catch (error) {
    console.error(`[DEBUG] fetchGraphData: Error for ${mirnaNameToSearch}:`, error);
    graphData.value = {nodes: [], relationships: []};
  } finally {
    if (session) await session.close();
  }
}

async function submitSearch() {
  isLoading.value = true;
  showOutput.value = false;
  graphDataKey.value++;

  const currentMirnasInput = mirnas.value;
  rawPredictions.value = [];
  graphData.value = {nodes: [], relationships: []};

  const mirnaList = currentMirnasInput.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
  inputtedMirna.value = mirnaList.join(', ') || "N/A";

  if (mirnaList.length === 1) {
    const singleMirna = mirnaList[0];
    inputtedMirna.value = singleMirna;
    await Promise.all([
      fetchTableData(singleMirna),
      fetchGraphData(singleMirna)
    ]);
    // Log the OBJECTS after processing
    console.log("[AFTER FETCH] Processed Nodes Object:", JSON.parse(JSON.stringify(processedGraphNodes.value)));
    console.log("[AFTER FETCH] Processed Edges Object:", JSON.parse(JSON.stringify(processedGraphEdges.value)));

  } else if (mirnaList.length > 1) {
    alert('Multiple miRNAs entered. Graph view supports single miRNA only. Table view will attempt to load data for the first miRNA listed if available.');
    if (mirnaList.length > 0) await fetchTableData(mirnaList[0]);
    viewMode.value = 'table';
  } else {
    alert('Please enter at least one miRNA.');
  }

  isLoading.value = false;
  showOutput.value = true;

  // Update v-if for dynamic graph to check Object keys
  if (mirnaList.length === 1 && Object.keys(processedGraphNodes.value).length > 0) {
    viewMode.value = 'graph';
  } else if (filteredPredictions.value.length > 0) {
    viewMode.value = 'table';
  } else if (mirnaList.length === 1) {
    viewMode.value = 'graph';
  } else {
    viewMode.value = 'table';
  }
}

const filteredPredictions = computed(() => {
  if (!rawPredictions.value || rawPredictions.value.length === 0) return [];
  let predictionsByTool = rawPredictions.value;
  if (selectedHeuristics.value.length > 0) {
    predictionsByTool = rawPredictions.value.filter(prediction =>
        prediction.tools && prediction.tools.some(tool => selectedHeuristics.value.includes(tool))
    );
  }
  if (selectedHeuristics.value.length > 0) {
    if (mergeStrategy.value === 'intersection') {
      return predictionsByTool.filter(prediction =>
          prediction.tools && selectedHeuristics.value.every(tool => prediction.tools.includes(tool))
      );
    } else if (mergeStrategy.value === 'at least two tools') {
      return predictionsByTool.filter(prediction =>
          prediction.tools && prediction.tools.filter(tool => selectedHeuristics.value.includes(tool)).length >= 2
      );
    }
  }
  return predictionsByTool;
});

function toggleViewMode() {
  viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph';
}

</script>

<style scoped>
/* Styles remain the same */
.fill-height { height: 100%; }
.bio-bg { background: linear-gradient(135deg, #e0f7fa, #f0faee); position: relative; overflow: hidden; min-height: 100vh; }
.dna-bg::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; background-repeat: repeat; background-position: 0 0; background-size: 300px 800px; opacity: 0.12; animation: scrollBackground 40s linear infinite; background-image: url("data:image/svg+xml,%3Csvg width='300' height='800' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2388c0d0' stroke-width='3'%3E%3Cpath d='M150 0 C280 50, 20 150, 150 200 C280 250, 20 350, 150 400 C280 450, 20 550, 150 600 C280 650, 20 750, 150 800'/%3E%3C/g%3E%3Cg fill='%23cba8ff'%3E%3Ccircle cx='150' cy='50' r='4'/%3E%3Ccircle cx='150' cy='150' r='4'/%3E%3Ccircle cx='150' cy='250' r='4'/%3E%3Ccircle cx='150' cy='350' r='4'/%3E%3Ccircle cx='150' cy='450' r='4'/%3E%3Ccircle cx='150' cy='550' r='4'/%3E%3Ccircle cx='150' cy='650' r='4'/%3E%3Ccircle cx='150' cy='750' r='4'/%3E%3C/g%3E%3C/svg%3E"); }
@keyframes scrollBackground { 0% { background-position: 0 0; } 100% { background-position: 0 800px; } }
.z-index-1 { z-index: 1; position: relative; }
.w-100 { width: 100%; }
</style>