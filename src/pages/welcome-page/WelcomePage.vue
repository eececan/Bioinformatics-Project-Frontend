<template>
  <v-container class="py-6">
    <v-card class="pa-6">
      <v-form @submit.prevent="submitSearch">
        <!-- miRNA Input -->
        <v-textarea
            v-model="mirnas"
            label="Enter miRNA(s)"
            rows="4"
            outlined
            hint="Separate with commas or newlines"
            persistent-hint
            class="mb-4"
        />

        <!-- Heuristics Multi-Select -->
        <v-select
            v-model="selectedHeuristics"
            :items="heuristics"
            label="Select Heuristics"
            multiple
            chips
            outlined
            class="mb-4"
        />

        <!-- Merge Strategy Select -->
        <v-select
            v-model="mergeStrategy"
            :items="strategies"
            label="Merge Strategy"
            outlined
            chips
            class="mb-6"
        />

        <!-- Submit Button -->
        <div class="text-center">
          <v-btn type="submit" color="primary">Analyze</v-btn>
        </div>
      </v-form>
    </v-card>

    <!-- Debug Output -->
    <v-card v-if="showOutput" class="mt-6 pa-4">
      <h3 class="text-lg font-semibold mb-2">Submitted Payload:</h3>
      <pre class="text-sm">{{ JSON.stringify(payload, null, 2) }}</pre>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';

const mirnas = ref('');
const selectedHeuristics = ref([]);
const mergeStrategy = ref([]);
const heuristics = ['PITA', 'MiRanda', 'RNA22', 'TargetScan'];
const strategies = ['intersection', 'score'];

const payload = ref({});
const showOutput = ref(false);

function submitSearch() {
  const mirnaList = mirnas.value
      .split(/[\n,]+/)
      .map(m => m.trim())
      .filter(Boolean);

  payload.value = {
    mirnas: mirnaList,
    heuristics: selectedHeuristics.value,
    strategy: mergeStrategy.value,
  };

  // Replace with actual API call
  console.log('Submitting:', payload.value);
  showOutput.value = true;
}
</script>

