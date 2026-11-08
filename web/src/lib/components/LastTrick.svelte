<!-- The last finished trick: the four cards in the order they were played,
     who played each, which led, and who took it. Click anywhere to close. -->
<script lang="ts">
	import * as H from '$engine/rules/hearts.ts';
	import type { Trick } from '$engine/rules/hearts.ts';
	import { CARD_H, CARD_W } from '$engine/ui/theme.ts';
	import { trickPoints } from '$engine/game/seals.ts';
	import { game } from '../app/game.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';

	let { trick }: { trick: Trick } = $props();
	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const pts = $derived(trickPoints(run.seals, trick));
	const name = (s: number) => (s === H.PLAYER ? 'You' : H.SEAT_NAMES[s]);
	const took = $derived(trick.winner === H.PLAYER ? 'You took it' : `${name(trick.winner)} took it`);
	const edge = $derived(pts > 0 ? 'var(--bad)' : 'var(--brass)');
	const k = 1.25;
</script>

<button class="scrim" aria-label="Close" onclick={() => (game.showLastTrick = false)}></button>
<div
	class="panel last"
	style:left="{L.tableCX - 280}px"
	style:top="{L.trickCY - 150}px"
	style:border-color={edge}
	role="dialog"
	aria-label="Trick {trick.index}"
>
	<div class="head">
		<span class="title">Trick {trick.index}</span>
		<span class="took" style:color={pts > 0 ? 'var(--bad)' : 'var(--ink)'}>{pts > 0 ? `${took} · ${pts} point${pts === 1 ? '' : 's'}` : took}</span>
	</div>
	<div class="cards">
		{#each trick.plays as p, i (i)}
			{@const won = p.seat === trick.winner}
			<div class="play">
				<img
					src={cardFace(p.card, false, settings.pixelCards, settings.fourColor)}
					alt=""
					style:width="{CARD_W * k}px"
					style:height="{CARD_H * k}px"
					style:outline={won ? `3px solid ${pts > 0 ? 'var(--bad)' : 'var(--brass)'}` : 'none'}
				/>
				<span class="who" class:won>{name(p.seat)}</span>
				<span class="led">{i === 0 ? 'led' : ' '}</span>
			</div>
		{/each}
	</div>
	{#if trick.kitty.length}<div class="kitty">Plus the kitty: {trick.kitty.length} card{trick.kitty.length === 1 ? '' : 's'}</div>{/if}
	<div class="hint">click to close</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 129;
		background: rgba(0, 0, 0, 0.4);
		border: none;
		padding: 0;
		cursor: default;
	}
	.last {
		z-index: 130;
		width: 560px;
		padding: 18px 26px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		pointer-events: none;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		width: 100%;
	}
	.title {
		font-size: 26px;
		font-weight: 700;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.took {
		font-size: 18px;
	}
	.cards {
		display: flex;
		gap: 18px;
	}
	.play {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.play img {
		image-rendering: pixelated;
		outline-offset: 2px;
	}
	.who {
		font-size: 16px;
		color: var(--ink-dim);
	}
	.who.won {
		color: var(--brass);
	}
	.led {
		font-size: 12px;
		color: var(--ink-faint);
		min-height: 14px;
	}
	.kitty {
		font-size: 14px;
		color: var(--ink-dim);
	}
	.hint {
		font-size: 13px;
		color: var(--ink-faint);
	}
</style>
