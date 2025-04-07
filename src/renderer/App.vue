<script setup lang="ts">
import viteLogo from "./assets/vite.svg";
import vueLogo from "./assets/vue.svg";

import HelloWorld from "./components/HelloWorld.vue";

window.electronAPI.sendMessage("Hello from App.vue!");
</script>

<template>
  <HelloWorld />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
