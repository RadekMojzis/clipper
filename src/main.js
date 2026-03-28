import { createApp } from "vue";
import App from "./App.vue";
import wheelStep from "./directives/wheelStep";
import { FontAwesomeIcon } from "./fontawesome";
import "./style.css";

createApp(App)
  .component("fa", FontAwesomeIcon)
  .directive("wheel-step", wheelStep)
  .mount("#app");
