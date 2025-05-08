import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Tailwind
import './input.css'
import 'tailwindcss/tailwind.css'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Create Vuetify instance
const vuetify = createVuetify({
    components,
    directives
})

// Create Vue app ONCE
const app = createApp(App)

app.use(router)
app.use(vuetify)
app.mount('#app')
