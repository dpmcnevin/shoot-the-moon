<!-- The hand's score, counted up line by line: dodged points (or the moon),
     upgrades and relics, then chips x mult. -->
<script lang="ts">
	import { scale, fly } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import * as H from '$engine/rules/hearts.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const hand = $derived(game.hand);
	const r = $derived(hand.result!);
	const rv = $derived(game.reveal!);
	const shown = $derived(rv.items.slice(0, rv.shown));
	const running = $derived.by(() => {
		let chips = 0,
			mult = 1;
		for (const i of shown) {
			chips += i.chips ?? 0;
			mult += i.mult ?? 0;
			mult *= i.xmult ?? 1;
		}
		return { chips, mult };
	});
	const chips = new Tween(0, { duration: 260, easing: cubicOut });
	const mult = new Tween(1, { duration: 260, easing: cubicOut });
	$effect(() => {
		chips.target = running.chips;
		mult.target = running.mult;
	});
	const board = new Tween(0, { duration: 700, easing: cubicOut });
	$effect(() => {
		board.target = run.score - (rv.done ? 0 : r.total);
	});

	function parts(i: (typeof rv.items)[number]) {
		const out: { text: string; cls: string }[] = [];
		if (i.money) out.push({ text: '+$' + i.money, cls: 'money' });
		if (i.chips) out.push({ text: `+${num(i.chips)}`, cls: 'chips' });
		if (i.mult) out.push({ text: `+${i.mult.toFixed(2)} mult`, cls: 'multc' });
		if (i.xmult && i.xmult !== 1) out.push({ text: `x${i.xmult.toFixed(2)}`, cls: 'multc' });
		return out;
	}
	const title = $derived(
		r.shooter === H.PLAYER
			? 'You shot the moon!'
			: r.shooter !== null
				? `${H.SEAT_NAMES[r.shooter]} shot the moon`
				: r.myPoints === 0
					? 'Clean hand!'
					: `You took ${r.myPoints} point${r.myPoints === 1 ? '' : 's'}`
	);
	const good = $derived(r.shooter === H.PLAYER || (r.shooter === null && r.myPoints <= 6));
	const nextLabel = $derived(
		run.score >= run.target ? 'Board won!' : run.handsLeft <= 0 ? 'Out of hands' : `Next hand  (${run.handsLeft} left)`
	);
	const pw = $derived(Math.min(580, L.W - 32));
	const ph = 500;
	const box = $derived({ x: L.tableCX - pw / 2, y: L.orientation === 'portrait' ? L.table.y + 200 : 100 });
	$effect(() => {
		rv.totalY = box.y + ph - 148;
	});
</script>

{#if run.phase === PHASE.HAND_SCORED}
	<div class="panel score" class:good style:left="{box.x}px" style:top="{box.y}px" style:width="{pw}px" style:height="{ph}px"
		transition:scale={{ start: 0.6, duration: 320, easing: backOut }}>
		<h2 class:goodc={good} class:badc={!good}>{title}</h2>
		<div class="seats">
			{#each [3, 4, 1, 2] as s (s)}
				<span class:me={s === H.PLAYER}>{s === H.PLAYER ? 'You' : H.SEAT_NAMES[s]} <b>{r.points[s]}</b></span>
			{/each}
		</div>
		<div class="lines">
			{#each shown as item, i (i)}
				<div class="line" in:fly={{ x: -20, duration: 180, easing: cubicOut }}>
					<span>{item.label}</span>
					<span class="parts">{#each parts(item) as p (p.text)}<span class={p.cls}>{p.text}</span>{/each}</span>
				</div>
			{/each}
		</div>
		<div class="totals">
			<span class="pill chips-bg">{num(chips.current)}</span>
			<span class="x">x</span>
			<span class="pill mult-bg">{mult.current.toFixed(2)}</span>
			{#if rv.done}<span class="total" in:scale={{ start: 1.25, duration: 250 }}>= {num(r.total)}</span>{/if}
		</div>
		<div class="board">
			<div>Board {num(board.current)} / {num(run.target)}</div>
			<div class="bar"><div class="fill" style:width="{Math.min(100, (100 * board.current) / Math.max(1, run.target))}%"
				style:background={run.score >= run.target && rv.done ? 'var(--good)' : 'var(--brass)'}></div></div>
		</div>
		<div class="foot">
			{#if rv.done}
				<Button pulse onclick={() => game.continueAfterHand()} style="width: 220px">{nextLabel}</Button>
			{:else}
				<span class="faint">click to skip</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.score {
		display: flex;
		flex-direction: column;
		padding: 18px 30px;
		gap: 6px;
		border-color: var(--bad);
		z-index: 120;
	}
	.score.good {
		border-color: var(--good);
	}
	h2 {
		margin: 0;
		font-size: 28px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.goodc {
		color: var(--good);
	}
	.badc {
		color: var(--bad);
	}
	.seats {
		display: flex;
		gap: 18px;
		color: var(--ink-dim);
		font-size: 16px;
	}
	.seats .me {
		color: var(--ink);
	}
	.lines {
		flex: 1;
		margin-top: 12px;
		overflow: hidden;
		font-size: 17px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		height: 25px;
		align-items: center;
	}
	.parts {
		display: flex;
		gap: 14px;
		font-variant-numeric: tabular-nums;
	}
	.chips {
		color: var(--chips);
	}
	.money {
		color: var(--brass);
	}
	.multc {
		color: var(--mult);
	}
	.totals {
		display: flex;
		align-items: center;
		gap: 8px;
		border-top: 1px solid var(--panel-edge);
		padding-top: 10px;
		height: 50px;
	}
	.pill {
		font-size: 28px;
		font-weight: 700;
		padding: 2px 12px;
		border-radius: 8px;
		box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.2);
		font-variant-numeric: tabular-nums;
	}
	.chips-bg {
		background: var(--chips);
	}
	.mult-bg {
		background: var(--mult);
	}
	.x {
		font-size: 28px;
		color: var(--ink-dim);
	}
	.total {
		margin-left: auto;
		font-size: 30px;
		font-weight: 700;
		text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
	}
	.board {
		font-size: 17px;
		margin-top: 8px;
	}
	.bar {
		height: 12px;
		background: var(--bg);
		border-radius: 6px;
		overflow: hidden;
		margin-top: 6px;
	}
	.fill {
		height: 100%;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		height: 48px;
		margin-top: 8px;
	}
	.faint {
		color: var(--ink-faint);
		font-size: 14px;
	}
</style>
