<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Shoot the Moon — a hearts roguelike</title>
	<meta name="description" content="A hearts roguelike: dodge points, shoot the moon, and build a relic engine across eight tables." />
</svelte:head>

{@render children()}
