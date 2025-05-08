<template>
  <v-container fluid class="pa-10 bio-bg text-grey-darken-4">
    <div class="dna-bg"></div>

    <!-- Title -->
    <div class="text-center mb-8 position-relative z-index-1">
      <v-icon size="64" color="green darken-2">mdi-dna</v-icon>
      <h1 class="text-h4 font-weight-bold mt-2">miRNA Target Gene & Pathway Analyzer</h1>
      <h2 class="subtitle-1 text-grey mt-1 mb-12">
        Analyze miRNA interactions, predicted target genes, and affected pathways
      </h2>
    </div>

    <!-- Form and Results -->
    <v-row justify="center" class="z-index-1 position-relative">
      <!-- Form -->
      <v-col cols="12" md="6" lg="5">
        <v-card class="pa-6 rounded-lg elevation-10">
          <v-form @submit.prevent="submitSearch">
            <!-- Collapsible Textarea -->
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

            <!-- Heuristics -->
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
                <v-tooltip text="Heuristics like PITA, MiRanda, RNA22, TargetScan">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <!-- Merge Strategy -->
            <v-select
                v-model="mergeStrategy"
                :items="strategies"
                label="Merge Strategy"
                outlined
                chips
                class="mb-4"
            >
              <template #append>
                <v-tooltip text="'intersection' = common targets, 'score-based' = aggregate ranking">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-help-circle</v-icon>
                  </template>
                </v-tooltip>
              </template>
            </v-select>

            <!-- Submit Button -->
            <div class="text-center">
              <v-btn type="submit" color="green darken-1" dark>
                <v-icon left>mdi-magnify</v-icon> Analyze
              </v-btn>
            </div>
          </v-form>
        </v-card>

        <!-- Payload -->
        <v-card v-if="showOutput" class="mt-6 pa-4">
          <h3 class="text-h6 font-weight-bold mb-2">Submitted Payload:</h3>
          <pre class="text-sm">{{ JSON.stringify(payload, null, 2) }}</pre>
        </v-card>

        <!-- Target Genes -->
        <v-card v-if="targetGenes.length" class="mt-6 pa-4">
          <h3 class="text-h6 font-weight-bold mb-2">Predicted Target Genes:</h3>
          <v-chip-group column>
            <v-chip v-for="(gene, i) in targetGenes" :key="i" color="indigo lighten-4" class="ma-1">
              {{ gene }}
            </v-chip>
          </v-chip-group>
        </v-card>

        <!-- Pathways -->
        <v-card v-if="pathwayResults.length" class="mt-6 pa-4">
          <h3 class="text-h6 font-weight-bold mb-2">Affected Pathways (via Enrichment Analysis):</h3>
          <v-list dense>
            <v-list-item v-for="(pathway, index) in pathwayResults" :key="index" class="py-1">
              <v-list-item-content>
                <v-list-item-title>
                  <strong>{{ pathway.name }}</strong> — FDR: <span class="font-weight-medium">{{ pathway.fdr }}</span>
                </v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Graph Placeholder -->
      <v-col cols="12" md="4" class="d-flex flex-column align-center justify-center">
        <div v-if="!networkShown" class="text-center">
          <v-icon size="120" color="grey lighten-1">mdi-graph</v-icon>
          <p class="mt-2 text-subtitle-2 text-grey">Your network will be shown here.</p>
        </div>
        <div
            v-else
            id="network-visualization"
            class="pa-4 elevation-2 rounded-lg"
            style="width: 100%; height: 300px; background-color: #fafafa; border: 2px dashed #ccc;"
        >
          <p class="text-center text-grey-darken-2 mt-10">[Network Visualization Placeholder]</p>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';

const mirnas = ref('');
const selectedHeuristics = ref([]);
const mergeStrategy = ref(null);
const heuristics = ['PITA', 'MiRanda', 'RNA22', 'TargetScan'];
const strategies = ['intersection', 'union', 'score-based'];

const payload = ref({});
const showOutput = ref(false);
const networkShown = ref(false);
const targetGenes = ref([]);
const pathwayResults = ref([]);

async function submitSearch() {
  const mirnaList = mirnas.value
      .split(/[\n,]+/)
      .map(m => m.trim())
      .filter(Boolean);

  payload.value = {
    mirnas: mirnaList,
    heuristics: selectedHeuristics.value,
    strategy: mergeStrategy.value
  };

  console.log('Submitting:', payload.value);
  showOutput.value = true;
  networkShown.value = true;

  try {
    const response = await fetch('/api/pathways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.value),
    });
    const data = await response.json();
    targetGenes.value = data.genes || [];
    pathwayResults.value = data.pathways || [];
  } catch (err) {
    console.error('Fetch error:', err);
    targetGenes.value = [];
    pathwayResults.value = [];
  }
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
