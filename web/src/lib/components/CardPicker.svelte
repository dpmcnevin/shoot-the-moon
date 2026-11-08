<!-- Choose a card from the run's pack: for a seal, or for a pack item (Burn,
     Recolor, Promote, Copy). Shows the pack as it really is now, duplicates
     and all, with each card's seal. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as cards from '$engine/rules/cards.ts';
	import type { Card } from '$engine/rules/cards.ts';
	import { SEALS, sealOf } from '$engine/game/seals.ts';
	import { CARD_EDITIONS, editionOf } from '$engine/game/cardEditions.ts';
	import Shine from './Shine.svelte';
	import * as packs from '$engine/game/pack.ts';
	import { game } from '../app/game.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import SealBadge from './SealBadge.svelte';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	const run = $derived(game.run!);
	const item = $derived(run.shop!.items[game.sealPick!]);
	const pack = $derived.by(() => {
		void game.v;
		return packs.sortedPack(run.pack);
	});
	const rows = $derived([4, 3, 2, 1].map((s) => pack.filter((c) => c.suit === s)).filter((r) => r.length > 0));
	const cols = $derived(Math.max(13, ...rows.map((r) => r.length)));

	function usable(c: Card): [boolean, string?] {
		if (item.kind !== 'pack') return [true];
		return packs.canApply(run, item.def, c);
	}

	let hovered = $state<Card | null>(null);
	const note = $derived.by(() => {
		const c = hovered;
		if (!c) return `Costs $${item.cost} · pack: ${run.pack.length} cards`;
		const [ok, why] = usable(c);
		if (!ok) return `${cards.name(c)}: ${why}`;
		const existing = sealOf(run.seals, c);
		if (item.kind === 'seal') return existing ? `${cards.name(c)} (replaces its ${SEALS[existing].name})` : cards.name(c);
		if (item.kind === 'edition') {
			const had = editionOf(run.cardEditions, c);
			return had ? `${cards.name(c)} (replaces its ${CARD_EDITIONS[had].name} edition)` : `${item.def.name} ${cards.name(c)}`;
		}
		if (item.kind === 'pack') {
			const d = item.def;
			if (d.key === 'burn') return `Burn ${cards.name(c)}${existing || editionOf(run.cardEditions, c) ? ' (and what is on it)' : ''}`;
			if (d.key === 'promote') return `${cards.name(c)} becomes ${cards.RANK_NAMES[c.rank + 1]}${cards.SUITS[c.suit].glyph}`;
			if (d.key === 'recolor') return `${cards.name(c)} becomes ${cards.RANK_NAMES[c.rank]}${cards.SUITS[d.suit!].glyph}`;
			return `Add another ${cards.name(c)}`;
		}
		return cards.name(c);
	});
</script>

<div class="backdrop" role="presentation" onclick={() => (game.sealPick = null)} transition:fade={{ duration: 120 }}></div>
<div class="picker" transition:scale={{ start: 0.7, duration: 300, easing: backOut }}>
	<div class="head">
		{#if item.kind === 'seal'}<SealBadge seal={item.def.key} size={42} />{:else if item.kind === 'pack'}<Icon name={item.def.icon} scale={2} />{/if}
		<div>
			<h2>Choose a card: {item.name}</h2>
			<div class="dim">{item.kind === 'seal' || item.kind === 'pack' || item.kind === 'edition' ? item.def.text : ''}.</div>
		</div>
	</div>
	<div class="grid">
		{#each rows as row, ri (ri)}
			<div class="row" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))">
				{#each row as c (c.id)}
					{@const existing = sealOf(run.seals, c)}
					{@const ok = usable(c)[0]}
					<button
						class="card"
						class:pixel={settings.pixelCards}
						class:off={!ok}
						aria-label={cards.name(c)}
						onpointerenter={() => (hovered = c)}
						onpointerleave={() => hovered === c && (hovered = null)}
						onclick={() => game.placeSeal(c.id!)}
					>
						<Shine edition={editionOf(run.cardEditions, c)}><img src={cardFace(c, false, settings.pixelCards, settings.fourColor)} alt="" draggable="false" /></Shine>
						{#if existing}<span class="badge"><SealBadge seal={existing} size={21} /></span>{/if}
					</button>
				{/each}
			</div>
		{/each}
	</div>
	<div class="foot">
		<span class="dim">{note}</span>
		<Button variant="plain" onclick={() => (game.sealPick = null)} style="width: 140px">Cancel</Button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.picker {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: min(980px, calc(100% - 20px));
		box-sizing: border-box;
		padding: 18px 22px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
		--px-sy: 6px;
		clip-path: var(--px-clip);
		z-index: 310;
	}
	.head {
		display: flex;
		gap: 14px;
		align-items: center;
		margin-bottom: 14px;
	}
	h2 {
		margin: 0;
		font-size: 24px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 15px;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: grid;
		gap: 4px;
	}
	.card {
		position: relative;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		aspect-ratio: 80 / 112;
		border-radius: 5px;
		transition: transform 0.1s;
		touch-action: manipulation;
	}
	.card :global(.shine) {
		width: 100%;
		height: 100%;
	}
	.card img {
		width: 100%;
		height: 100%;
		display: block;
		filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.35));
	}
	.card.pixel img {
		image-rendering: pixelated;
	}
	.card:hover {
		transform: translateY(-4px) scale(1.06);
		z-index: 2;
	}
	.card.off {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.card.off:hover {
		transform: none;
	}
	.badge {
		position: absolute;
		right: -3px;
		top: -3px;
		display: flex;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 14px;
	}
</style>
