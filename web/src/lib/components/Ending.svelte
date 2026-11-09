<!-- The end of a run: won all eight rubbers, or ran out of deals. -->
<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as R from '$engine/game/run.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';

	let { victory }: { victory: boolean } = $props();
	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const s = $derived(run.stats);
	const sub = $derived(
		victory
			? 'You beat all eight tables.'
			: `Fell on ${R.boardName(run)} of table ${run.table}, ${num(Math.max(0, run.target - run.score))} short.`
	);
	const rows = $derived([
		['Hands played', String(s.handsPlayed)],
		['Moons shot', String(s.moons)],
		['Clean hands', String(s.cleanHands)],
		['Points taken', String(s.pointsTaken)],
		['Best hand', num(s.bestHand)],
		['Seed', String(run.seed)]
	]);
	const box = $derived({ x: L.tableCX - 260, y: L.orientation === 'portrait' ? L.table.y + 240 : 130 });
</script>

<div
	class="panel ending"
	class:victory
	style:left="{box.x}px"
	style:top="{box.y}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>{victory ? 'Moon over the club!' : 'Out of hands'}</h2>
	<div class="dim">{sub}</div>
	<div class="rows">
		{#each rows as [label, value] (label)}
			<div class="row"><span>{label}</span><span class="brass">{value}</span></div>
		{/each}
	</div>
	<button class="log" title="A text log of the whole run, to send for analysis" onclick={() => game.downloadLog()}>Download the game log</button>
	<div class="foot">
		<Button variant="plain" onclick={() => game.toMenu()} style="width: 170px">Main menu</Button>
		{#if victory && game.run?.endlessOn && !game.run?.endless}
			<Button variant="ploy" onclick={() => game.goEndless()} style="width: 150px" title="Go on past table 8; the goals keep growing">Keep going</Button>
		{/if}
		<Button
			pulse
			onclick={() => {
				game.seedInput = '';
				game.newRun();
			}}
			style="width: 170px">New run</Button
		>
	</div>
</div>

<style>
	.log {
		display: block;
		margin: 10px 0 0 auto;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 15px;
		color: var(--ink-dim);
		text-decoration: underline;
		cursor: pointer;
	}
	.log:hover {
		color: var(--ink);
	}
	.ending {
		width: 520px;
		box-sizing: border-box;
		padding: 20px 30px;
		border-color: var(--bad);
		z-index: 120;
	}
	.ending.victory {
		border-color: var(--brass);
	}
	h2 {
		margin: 0;
		font-size: 44px;
		color: var(--bad);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
	}
	.victory h2 {
		color: var(--brass);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
		margin-top: 12px;
	}
	.rows {
		margin-top: 22px;
		font-size: 17px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		height: 28px;
	}
	.brass {
		color: var(--brass);
	}
	.foot {
		display: flex;
		justify-content: space-between;
		margin-top: 26px;
	}
</style>
