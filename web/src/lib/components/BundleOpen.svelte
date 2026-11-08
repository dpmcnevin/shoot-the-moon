<!-- An opened bundle: three choices side by side; take one, or none. -->
<script lang="ts">
	import { scale, fade, fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as R from '$engine/game/run.ts';
	import * as relics from '$engine/game/relics.ts';
	import * as cardEds from '$engine/game/cardEditions.ts';
	import * as bundles from '$engine/game/bundles.ts';
	import * as cards from '$engine/rules/cards.ts';
	import { C, css } from '$engine/ui/theme.ts';
	import { game } from '../app/game.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import Icon from './Icon.svelte';
	import Shine from './Shine.svelte';
	import Button from './Button.svelte';
	import { editionColor } from './editions.ts';

	const run = $derived(game.run!);
	const open = $derived((void game.v, run.opening!));
	const def = $derived(bundles.BUNDLES[open.bundle]);
	const cardOf = (id: number) => run.pack.find((c) => c.id === id)!;
</script>

<div class="backdrop" transition:fade={{ duration: 120 }}></div>
<div class="bundle" role="dialog" aria-label={def.name} transition:scale={{ start: 0.7, duration: 300, easing: backOut }}>
	<div class="head">
		<Icon name={def.icon} scale={2} />
		<div>
			<h2>{def.name}</h2>
			<div class="dim">Choose one.</div>
		</div>
	</div>
	<div class="choices">
		{#each open.options as c, i (i)}
			<div class="choice" in:fly={{ y: 40, duration: 320, delay: 120 + i * 110, easing: backOut }}
				style:border-color={c.kind === 'relic' ? css(C.rarity[c.def.rarity]) : c.kind === 'ploy' ? 'var(--ploy)' : editionColor(c.edition)}>
				{#if c.kind === 'relic'}
					<div class="kind" style:color={css(C.rarity[c.def.rarity])}>
						{#if c.edition}<span style:color={editionColor(c.edition)}>{relics.EDITIONS[c.edition].name.toUpperCase()}</span>{/if}
						{relics.RARITY_NAME[c.def.rarity]} relic
					</div>
					<div class="art"><Shine edition={c.edition}><Icon name={c.def.icon} scale={4} /></Shine></div>
					<h3>{c.def.name}</h3>
					<p>{relics.textAt(c.def, run.balance)}</p>
				{:else if c.kind === 'ploy'}
					<div class="kind" style:color="var(--ploy)">Ploy</div>
					<div class="art"><Icon name={c.def.icon} scale={4} /></div>
					<h3>{c.def.name}</h3>
					<p>{c.def.text}.</p>
				{:else}
					{@const card = cardOf(c.cardId)}
					<div class="kind" style:color={editionColor(c.edition)}>Card edition</div>
					<div class="art"><Shine edition={c.edition}><img class="card" src={cardFace(card, false, settings.pixelCards, settings.fourColor)} alt="" /></Shine></div>
					<h3>{cardEds.CARD_EDITIONS[c.edition].name} {cards.name(card)}</h3>
					<p>{cardEds.CARD_EDITIONS[c.edition].text}.</p>
				{/if}
				<div class="take"><Button sound={false} onclick={() => game.pickBundle(i)} style="width: 100%">Take</Button></div>
			</div>
		{/each}
	</div>
	<div class="foot">
		<span class="dim">{open.bundle === 'relic' ? `Relics ${R.relicSlotsUsed(run)}/${R.relicSlots(run)}` : open.bundle === 'ploy' ? `Ploys ${run.ploys.length}/2` : 'The edition stays on the card for the run.'}</span>
		<Button variant="plain" onclick={() => game.pickBundle(-1)} style="width: 160px">Take none</Button>
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 300;
	}
	.bundle {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: min(860px, calc(100% - 20px));
		box-sizing: border-box;
		padding: 18px 22px;
		background: var(--panel);
		border: 2px solid var(--ploy);
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
		font-size: 26px;
		color: var(--ploy-light, var(--ink));
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 15px;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}
	.choice {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
		min-height: 300px;
		background: var(--bg);
		border: 2px solid;
		clip-path: var(--px-clip);
	}
	.kind {
		font-size: 14px;
	}
	.art {
		display: flex;
		justify-content: center;
		padding: 10px 0;
	}
	.card {
		width: 80px;
		height: 112px;
		display: block;
		image-rendering: pixelated;
	}
	h3 {
		margin: 0;
		font-size: 20px;
	}
	p {
		margin: 0;
		font-size: 15px;
		color: var(--ink-dim);
		line-height: 1.3;
	}
	.take {
		margin-top: auto;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 14px;
	}
</style>
