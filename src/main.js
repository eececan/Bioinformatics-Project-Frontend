import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './input.css'
import 'tailwindcss/tailwind.css';

const app = createApp(App)
app.component('BaseButton', BaseButton);
app.use(router);
app.use(i18n);
app.mount('#app')