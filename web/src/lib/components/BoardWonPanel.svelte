<!-- Board won: the payout, itemised, and the way into the club. Like a
     cash-out, the rows come in one by one, filling with dollar pips, and the
     total counts up a dollar at a time (the sidebar's money with it). A
     click on the panel skips to the end. -->
<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';
	import * as R from '$engine/game/run.ts';
	import * as sound from '../audio/sound.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { onDestroy } from 'svelte';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const p = $derived(run.lastPayout!);
	const rows = $derived(
		[
			['Board', p.board],
			['Unused hands', p.unused],
			['Interest', p.interest],
			...(p.relics > 0 ? [['Relics', p.relics]] : []),
			...(p.boss ? [['Boss beaten', p.boss]] : []),
			...(p.overshoot ? [[`Beat the goal by ${p.overshoot * 50}%+`, p.overshoot]] : [])
		] as [string, number][]
	);
	// The count-up: `shown` rows are in, and `counted` dollars of the total.
	let shown = $state(0);
	let counted = $state(0);
	let timer: ReturnType<typeof setTimeout> | null = null;
	const done = $derived(shown >= rows.length && counted >= p.total);
	// The money before this payout (read once: the count starts from it).
	const startMoney = game.run!.money - game.run!.lastPayout!.total;
	function finish() {
		if (timer) clearTimeout(timer);
		timer = null;
		shown = rows.length;
		counted = p.total;
		game.moneyShown = null;
	}
	function step() {
		const pace = 1 / (settings.speed || 1);
		if (shown < rows.length) {
			shown++;
			const amount = rows[shown - 1][1];
			sound.play('tick', { volume: 0.6, pitch: amount > 0 ? 1.1 : 0.85 });
			timer = setTimeout(step, (amount > 0 ? 300 : 200) * pace);
		} else if (counted < p.total) {
			counted++;
			game.moneyShown = startMoney + counted;
			sound.play('coin', { volume: 0.5, pitch: 0.9 + Math.min(0.6, counted * 0.05) });
			timer = setTimeout(step, Math.max(70, 260 - counted * 25) * pace);
		} else finish();
	}
	game.moneyShown = startMoney;
	timer = setTimeout(step, 450 / (settings.speed || 1));
	onDestroy(() => {
		if (timer) clearTimeout(timer);
		game.moneyShown = null;
	});

	const box = $derived({ x: L.tableCX - 230, y: L.orientation === 'portrait' ? L.table.y + 260 : 150 });
</script>

<!-- A click anywhere on the panel skips the count; the button is the keyboard way on. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
	role="group"
	aria-label="Payout"
	onclick={() => !done && finish()}
	class="panel won"
	style:left="{box.x}px"
	style:top="{box.y}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>{R.boardName(run)} won</h2>
	<div class="next">
		{run.board === R.BOARDS_PER_TABLE
			? run.table >= R.TABLES && !run.endless
				? 'That was the last table.'
				: `Table ${run.table} of ${R.TABLES} cleared. Next: table ${run.table + 1}.`
			: `Table ${run.table} of ${R.TABLES} · next: ${run.board + 1 === R.BOARDS_PER_TABLE ? 'the High Board' : `Board ${run.board + 1}`}`}
	</div>
	<div class="dim">{num(run.score)} scored against a goal of {num(run.target)}</div>
	<div class="rows">
		{#each rows as [label, amount], i (label)}
			<div class="row" class:hidden={i >= shown}>
				<span>{label}</span>
				<span class="amt">
					<span class="pips">{#each { length: Math.min(amount, 10) }, k (k)}<span class="pip"></span>{/each}</span>
					<span class:brass={amount > 0} class:faint={amount <= 0}>${amount}</span>
				</span>
			</div>
		{/each}
		<div class="divider"></div>
		<div class="row total"><span>Total</span><span class="brass" class:bump={counted > 0 && !done}>${counted}</span></div>
	</div>
	<div class="foot">
		<Button pulse={done} sound={false} onclick={(e) => { e.stopPropagation(); finish(); game.enterShop(); }} style="width: 200px">Enter the club</Button>
	</div>
</div>

<style>
	.won {
		width: 460px;
		box-sizing: border-box;
		padding: 18px 30px;
		border-color: var(--brass);
		z-index: 120;
	}
	h2 {
		margin: 0;
		font-size: 28px;
		color: var(--good);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
		margin-top: 12px;
	}
	.next {
		font-size: 16px;
		color: var(--brass);
		margin-bottom: 4px;
	}
	.rows {
		margin-top: 24px;
		font-size: 17px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 28px;
	}
	.row.hidden {
		visibility: hidden;
	}
	.row:not(.hidden) {
		animation: rowin 0.18s steps(3) both;
	}
	@keyframes rowin {
		from {
			transform: translateX(-12px);
			opacity: 0;
		}
	}
	.amt {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pips {
		display: flex;
		gap: 3px;
	}
	.pip {
		width: 8px;
		height: 8px;
		background: var(--brass);
		clip-path: var(--px-clip);
		box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25);
	}
	.bump {
		display: inline-block;
		animation: bump 0.12s steps(2);
	}
	@keyframes bump {
		50% {
			transform: scale(1.18);
		}
	}
	.total {
		font-size: 20px;
		font-weight: 700;
	}
	.brass {
		color: var(--brass);
	}
	.faint {
		color: var(--ink-faint);
	}
	.divider {
		height: 1px;
		background: var(--panel-edge);
		margin: 6px 0;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 22px;
	}
</style>
