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
        <v-card class="pa-6 rounded-lg elevation-10">
          <v-form @submit.prevent="submitSearch">
            <v-textarea
                v-model="mirnas"
                label="Enter miRNA(s)"
                auto-grow
                rows="1"
                outlined
                hint="Separate with commas or newlines"
                persistent-hint
                class="mb-4"
            />

            <v-select
                v-model="selectedHeuristics"
                :items="heuristics"
                label="Select Heuristics"
                multiple
                chips
                outlined
                class="mb-2"
            >
              <template #append>
                <v-tooltip text="Select at least 2 tools">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <v-select
                v-model="mergeStrategy"
                :items="strategies"
                label="Merge Strategy"
                outlined
                chips
                class="mb-4"
            >
              <template #append>
                <v-tooltip text="'union' = all results, 'intersection' = common targets, 'at least two tools' = targets predicted by at least two tools">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <div class="text-center">
              <v-btn type="submit" color="green darken-1" dark>
                <v-icon left>mdi-magnify</v-icon> Analyze
              </v-btn>
            </div>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" md="6" class="d-flex flex-column align-center justify-center">
        <div v-if="!filteredPredictions.length && showOutput" class="text-center">
          <v-icon size="120" color="grey lighten-1">mdi-graph</v-icon>
          <p class="mt-2 text-subtitle-2 text-grey">Your network will be shown here.</p>
        </div>

        <div v-if="filteredPredictions.length" class="w-100">
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
              id="network-visualization"
              class="pa-4 elevation-2 rounded-lg"
              style="width: 100%; height: 300px; background-color: #fafafa; border: 2px dashed #ccc;"
          >
            <p class="text-center text-grey-darken-2 mt-10">[Network Visualization Placeholder]</p>
          </div>

          <div
              v-else
              class="pa-4 elevation-2 rounded-lg"
              style="width: 100%; height: 300px; background-color: #ffffff; border: 1px solid #ccc; overflow-y: auto;"
          >
            <v-simple-table dense>
              <thead>
              <tr>
                <th>miRNA</th>
                <th>Tool</th>
                <th>Gene</th>
                <th>Pathway</th>
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
            </v-simple-table>
          </div>
        </div>
        <div v-else-if="showOutput" class="mt-6">
          <v-card class="pa-4 rounded-lg elevation-10 text-center">
            <p class="text-subtitle-1 text-grey">No predictions found for {{ inputtedMirna }} based on the selected criteria.</p>
          </v-card>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import axios from 'axios';

const mirnas = ref('');
const inputtedMirna = ref('');
const selectedHeuristics = ref([]);
const mergeStrategy = ref(null);
const heuristics = ['RNA22', 'PicTar', 'miRTarBase', 'TargetScan'];
const strategies = ['union', 'intersection', 'at least two tools'];
const viewMode = ref('table');
const showOutput = ref(false);
const rawPredictions = ref([]);

const filteredPredictions = computed(() => {
  if (!showOutput || !rawPredictions.value.length) {
    return [];
  }

  return rawPredictions.value.filter(prediction => {
    // Filter by selected heuristics
    const hasSelectedTool = prediction.tools.some(tool => selectedHeuristics.value.includes(tool));
    if (selectedHeuristics.value.length > 0 && !hasSelectedTool) {
      return false;
    }

    // Apply merge strategy
    if (mergeStrategy.value === 'intersection') {
      return selectedHeuristics.value.every(tool => prediction.tools.includes(tool));
    } else if (mergeStrategy.value === 'at least two tools') {
      return prediction.tools.filter(tool => selectedHeuristics.value.includes(tool)).length >= 2;
    } else { // 'union' or null
      return true;
    }
  });
});

async function submitSearch() {
  const mirnaList = mirnas.value
      .split(/[\n,]+/)
      .map(m => m.trim())
      .filter(Boolean);

  if (mirnaList.length === 1) {
    inputtedMirna.value = mirnaList[0];
    try {
      const response = await axios.get(`/api/mirna/predictions?name=${inputtedMirna.value}`);
      rawPredictions.value = response.data.predictions.flatMap(pred =>
          pred.pathways.map(pathway => ({
            gene: pred.gene,
            tools: pred.tools,
            pathways: [pathway],
          }))
      );
      showOutput.value = true;
      viewMode.value = 'table';
    } catch (error) {
      console.error('Error fetching predictions:', error);
      rawPredictions.value = [];
      showOutput.value = true;
      viewMode.value = 'graph';
    }
  } else {
    alert('Please enter only one miRNA for detailed predictions.');
    rawPredictions.value = [];
    showOutput.value = false;
    viewMode.value = 'graph';
  }
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'graph' ? 'table' : 'graph';
}
</script>

<style scoped>
.bio-bg {
  background: linear-gradient(135deg, #e0f7fa, #f0faee);
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}

.dna-bg::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  background-repeat: repeat;
  background-position: 0 0;
  background-size: 300px 800px;
  opacity: 0.12;
  animation: scrollBackground 40s linear infinite;
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
</style>