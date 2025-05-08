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

// MDI icons
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
})


// Create Vue app ONCE
const app = createApp(App)

app.use(router)
app.use(vuetify)
app.mount('#app')
