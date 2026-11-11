<!-- The arcade's front door: pick a game. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import { GAMES } from '../games/index.ts';
	import { cardBack } from '../ui/images.ts';
	import Button from './Button.svelte';
	import * as R from '$kit/src/run/run.ts';
	import Collection from './Collection.svelte';
	import { settings } from '../settings.svelte.ts';
	import type { GameUI } from '../games/types.ts';
	let showing = $state<GameUI | null>(null);
	const deckOf = (id: string, m: R.GameModule) => R.allDecks(m).find((d) => d.key === (arcade.decks[id] ?? 'standard')) ?? R.allDecks(m)[0];
	function cycle(id: string, m: R.GameModule, step: number) {
		const all = R.allDecks(m);
		const i = all.findIndex((d) => d.key === deckOf(id, m).key);
		arcade.setDeck(id, all[(i + step + all.length) % all.length].key);
	}
</script>

<div class="menu">
	<h1>CARD ARCADE</h1>
	<div class="dim">cardkit prototype: one engine, a module per game</div>
	<div class="games">
		{#each GAMES as g (g.module.id)}
			{@const deck = deckOf(g.module.id, g.module)}
			<div class="game">
				<img src={cardBack(deck.key === 'standard' ? g.back : deck.back)} alt="" />
				<h2>{g.module.title}</h2>
				<div class="tag">{g.module.tagline}</div>
				<p>{g.blurb}</p>
				<div class="deck">
					<button class="arrow" title="Previous deck" onclick={() => cycle(g.module.id, g.module, -1)}><span class="tri left"></span></button>
					<div class="dn"><b>{deck.name}</b><span>{deck.text}</span></div>
					<button class="arrow" title="Next deck" onclick={() => cycle(g.module.id, g.module, 1)}><span class="tri right"></span></button>
				</div>
				{#if arcade.saved(g.module.id)}
					<Button onclick={() => arcade.start(g.module.id, true)} style="width: 100%">Continue</Button>
				{/if}
				<Button variant={arcade.saved(g.module.id) ? 'plain' : 'brass'} onclick={() => arcade.start(g.module.id)} style="width: 100%">New run</Button>
				<Button variant="plain" size="sm" onclick={() => (showing = g)} style="width: 100%">Collection & stats</Button>
			</div>
		{/each}
	</div>
	<div class="settings">
		<Button variant="plain" size="sm" onclick={() => settings.toggle('fourColor')} style="width: 160px">{settings.fourColor ? '4 colors' : '2 colors'}</Button>
	</div>
	{#if showing}<Collection ui={showing} close={() => (showing = null)} />{/if}
</div>

<style>
	.settings {
		position: absolute;
		right: 24px;
		top: 20px;
	}
	.menu {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 60px;
		gap: 10px;
	}
	h1 {
		margin: 0;
		font-size: 72px;
		color: var(--brass);
		text-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
	}
	.games {
		margin-top: 40px;
		display: flex;
		gap: 30px;
	}
	.game {
		width: 300px;
		padding: 20px;
		background: rgba(12, 22, 18, 0.9);
		border: 2px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}
	.game img {
		width: 80px;
		height: 112px;
		image-rendering: pixelated;
	}
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 30px;
	}
	.tag {
		color: var(--ink-dim);
	}
	p {
		margin: 0;
		text-align: center;
		min-height: 60px;
	}
	.deck {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		min-height: 44px;
	}
	.dn b {
		color: var(--brass);
	}
	.dn span {
		font-size: 12px;
		color: var(--ink-dim);
	}
	.arrow {
		width: 32px;
		height: 30px;
		border: none;
		background: var(--panel-edge);
		color: var(--ink);
		cursor: pointer;
	}
	/* Drawn arrows: the characters turn into emoji on Apple devices. */
	.tri {
		display: inline-block;
		width: 9px;
		height: 13px;
		background: currentColor;
	}
	.tri.left {
		clip-path: polygon(100% 0, 0 50%, 100% 100%);
	}
	.tri.right {
		clip-path: polygon(0 0, 100% 50%, 0 100%);
	}
</style>
