<!-- The card beside the sidebar that explains a tapped relic, seal or
     upgrade. Click anywhere to close. -->
<script lang="ts">
	import { game } from '../app/game.svelte.ts';
	const L = $derived(game.layout);
	const info = $derived(game.inspect!);
	const portrait = $derived(L.orientation === 'portrait');
	const left = $derived(portrait ? Math.min(L.W - 320, 20) : L.sidebar.w + 16);
	const top = $derived(portrait ? L.sidebar.h + 12 : Math.min(Math.max(info.y - 60, 20), L.H - 200));
</script>

<button class="scrim" aria-label="Close" onclick={() => (game.inspect = null)}></button>
<div class="panel card" style:left="{left}px" style:top="{top}px" style:border-color={info.color} role="dialog" aria-label={info.title}>
	<div class="kind" style:color={info.color}>{info.kind.toUpperCase()}</div>
	<div class="title">{info.title}</div>
	<div class="text">{info.text}</div>
	{#if info.note}<div class="note">{info.note}</div>{/if}
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 289;
		background: transparent;
		border: none;
		padding: 0;
		cursor: default;
	}
	.card {
		z-index: 290;
		width: 300px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.kind {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.text {
		font-size: 16px;
	}
	.note {
		font-size: 14px;
		color: var(--ink-dim);
		white-space: pre-line;
	}
</style>
