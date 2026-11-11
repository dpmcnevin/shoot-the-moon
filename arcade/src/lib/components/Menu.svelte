<!-- The arcade's front door: pick a game. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import { GAMES } from '../games/index.ts';
	import { cardBack } from '../ui/images.ts';
	import Button from './Button.svelte';
</script>

<div class="menu">
	<h1>CARD ARCADE</h1>
	<div class="dim">cardkit prototype: one engine, a module per game</div>
	<div class="games">
		{#each GAMES as g (g.module.id)}
			<div class="game">
				<img src={cardBack(g.back)} alt="" />
				<h2>{g.module.title}</h2>
				<div class="tag">{g.module.tagline}</div>
				<p>{g.blurb}</p>
				{#if arcade.saved(g.module.id)}
					<Button onclick={() => arcade.start(g.module.id, true)} style="width: 100%">Continue</Button>
				{/if}
				<Button variant={arcade.saved(g.module.id) ? 'plain' : 'brass'} onclick={() => arcade.start(g.module.id)} style="width: 100%">New run</Button>
			</div>
		{/each}
	</div>
</div>

<style>
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
</style>
