<!-- The deck: every card in the run's pack, by suit, with its seal and
     edition. Your own hand is greyed, so the rest is what the others hold
     between them. Open until the first trick of a hand is done (the Glass
     Deck keeps it open all hand, crossing off the cards already played). -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as cards from '$engine/rules/cards.ts';
	import * as H from '$engine/rules/hearts.ts';
	import * as R from '$engine/game/run.ts';
	import { sealOf, cardPoints } from '$engine/game/seals.ts';
	import { editionOf } from '$engine/game/cardEditions.ts';
	import * as packs from '$engine/game/pack.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import SealBadge from './SealBadge.svelte';
	import Shine from './Shine.svelte';
	import Button from './Button.svelte';

	const run = $derived(game.run!);
	const pack = $derived.by(() => {
		void game.v;
		return packs.sortedPack(run.pack);
	});
	const rows = $derived([4, 3, 2, 1].map((s) => pack.filter((c) => c.suit === s)).filter((r) => r.length > 0));
	const cols = $derived(Math.max(13, ...rows.map((r) => r.length)));
	const inHand = $derived(run.phase === PHASE.PASS || run.phase === PHASE.PLAY);
	/** Ids of the cards in your hand now (or dealt to you, while passing). */
	const mine = $derived.by(() => {
		void game.v;
		if (!inHand) return new Set<number>();
		const h = run.hand.state ? run.hand.state.hands[H.PLAYER] : run.hand.dealt[H.PLAYER];
		return new Set(h.map((c) => c.id!));
	});
	const played = $derived.by(() => {
		void game.v;
		return new Set((run.phase === PHASE.PLAY ? (run.hand.state?.played ?? []) : []).map((p) => p.card.id!));
	});
	const points = $derived(run.pack.reduce((n, c) => n + cardPoints(run.seals, c), 0));
	const note = $derived(
		!inHand
			? 'Every hand is dealt from these cards.'
			: played.size
				? 'Greyed: your hand. Crossed off: played. The rest are in the other hands.'
				: 'Greyed: your hand. The rest are in the other hands.'
	);
	// Close it once it may no longer be seen (the first trick is done).
	$effect(() => {
		void game.v;
		if (!R.canSeeDeck(run)) game.showDeck = false;
	});
</script>

<div class="backdrop" role="presentation" onclick={() => (game.showDeck = false)} transition:fade={{ duration: 120 }}></div>
<div class="deck" role="dialog" aria-label="The deck" transition:scale={{ start: 0.7, duration: 300, easing: backOut }}>
	<div class="head">
		<div>
			<h2>The deck</h2>
			<div class="dim">{run.pack.length} cards · {points} points{run.hand.kitty.length && inHand ? ` · ${run.hand.kitty.length} in the kitty` : ''}. {note}</div>
		</div>
		<Button variant="plain" size="sm" onclick={() => (game.showDeck = false)} style="width: 110px">Close</Button>
	</div>
	<div class="grid">
		{#each rows as row, ri (ri)}
			<div class="row" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))">
				{#each row as c (c.id)}
					{@const seal = sealOf(run.seals, c)}
					<div class="card" class:pixel={settings.pixelCards} class:mine={mine.has(c.id!)} class:played={played.has(c.id!)} aria-label={cards.name(c)}>
						<Shine edition={editionOf(run.cardEditions, c)}><img src={cardFace(c, false, settings.pixelCards, settings.fourColor)} alt="" draggable="false" /></Shine>
						{#if seal}<span class="badge"><SealBadge {seal} size={21} /></span>{/if}
						{#if played.has(c.id!)}<span class="cross"></span>{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.deck {
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
		justify-content: space-between;
		align-items: flex-start;
		gap: 14px;
		margin-bottom: 14px;
	}
	h2 {
		margin: 0;
		font-size: 24px;
		color: var(--brass);
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
		aspect-ratio: 80 / 112;
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
	.card.mine {
		opacity: 0.35;
		filter: grayscale(1);
	}
	.card.played {
		opacity: 0.3;
	}
	.cross {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top right, transparent calc(50% - 2px), var(--bad) calc(50% - 2px), var(--bad) calc(50% + 2px), transparent calc(50% + 2px));
	}
	.badge {
		position: absolute;
		right: -3px;
		top: -3px;
		display: flex;
	}
</style>
