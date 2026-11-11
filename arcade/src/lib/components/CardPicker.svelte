<!-- Choose a card from the run's pack (for a card edition or a seal): the
     pack by suit, each card with its edition and seal. -->
<script lang="ts">
	import * as R from '$kit/src/run/run.ts';
	import type { Run } from '$kit/src/run/run.ts';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import { CARD_EDITIONS } from '$kit/src/run/content.ts';
	import { cardFace } from '../ui/images.ts';
	import { editionColor } from './editions.ts';
	import SealBadge from './SealBadge.svelte';
	import Button from './Button.svelte';

	let { run, title, text, choose, cancel }: { run: Run; title: string; text: string; choose: (c: Card) => void; cancel: () => void } = $props();
	const rows = $derived([4, 3, 2, 1].map((s) => run.pack.filter((c) => c.suit === s).sort((a, b) => b.rank - a.rank)).filter((r) => r.length));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="veil" onclick={cancel}>
	<div class="panel" onclick={(e) => e.stopPropagation()}>
		<h2>Choose a card: {title}</h2>
		<p>{text}</p>
		{#each rows as row}
			<div class="row">
				{#each row as c (c.id)}
					{@const m = R.mod(run, c)}
					{@const seal = R.sealOf(run, c)}
					<button class="card" onclick={() => choose(c)} title={m.edition ? CARD_EDITIONS[m.edition].text : ''}>
						<img src={cardFace(c)} alt="" style:outline={m.edition ? `3px solid ${editionColor(m.edition)}` : ''} />
						{#if seal}<span class="badge"><SealBadge {seal} size={18} /></span>{/if}
					</button>
				{/each}
			</div>
		{/each}
		<div class="foot"><Button variant="plain" onclick={cancel} style="width: 140px">Cancel</Button></div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 150;
	}
	.panel {
		padding: 16px 20px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
	}
	h2 {
		margin: 0;
		color: var(--brass);
	}
	p {
		margin: 4px 0 10px;
		color: var(--ink-dim);
	}
	.row {
		display: flex;
		gap: 4px;
		margin-bottom: 6px;
	}
	.card {
		position: relative;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}
	.card:hover {
		transform: translateY(-4px);
	}
	.card img {
		width: 54px;
		height: 76px;
		image-rendering: pixelated;
		display: block;
	}
	.badge {
		position: absolute;
		right: -4px;
		top: -4px;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 6px;
	}
</style>
