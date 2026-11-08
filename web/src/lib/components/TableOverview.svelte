<!-- The table at a glance: its three boards with goals, hands and payouts,
     which are won, and the High Board's boss and its rule. Shown before each
     board starts, and from the sidebar's progress. -->
<script lang="ts">
	import * as R from '$engine/game/run.ts';
	import * as bosses from '$engine/game/bosses.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import * as tagsLib from '$engine/game/tags.ts';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const table = $derived(Math.min(run.table, R.TABLES));
	const boss = $derived(run.boss ? bosses.bossAt(run.boss, run.balance) : null);
	const boardWon = $derived(run.phase === PHASE.BOARD_WON || run.phase === PHASE.SHOP);
	const boards = $derived(
		Array.from({ length: R.BOARDS_PER_TABLE }, (_, i) => {
			const b = i + 1;
			const isBoss = run.bosses && b === R.BOARDS_PER_TABLE && !!boss;
			const short = isBoss && run.boss === 'shortchanger';
			let target = R.targetFor(table, b, run.tableBase);
			if (short && run.balance >= 3) target = Math.round(target * 0.8);
			return {
				b,
				name: b === R.BOARDS_PER_TABLE ? 'High Board' : `Board ${b}`,
				target,
				hands: R.HANDS_PER_BOARD - (short ? 1 : 0),
				reward: R.MONEY_PER_BOARD + (isBoss ? bosses.BOSS_BONUS : 0),
				isBoss,
				won: b < run.board || (b === run.board && boardWon),
				now: b === run.board && !(b === run.board && boardWon),
				skipped: (run.skipped ?? []).includes(b),
				tag: run.tagsOn && b < R.BOARDS_PER_TABLE ? run.tagOffers[b - 1] : undefined
			};
		})
	);
	const label = $derived.by(() => {
		const cur = boards.find((x) => x.b === run.board);
		if (!cur) return 'Back to the table';
		if (cur.isBoss && boss) return `Face ${boss.name}`;
		return run.handsLeft < run.handsThisBoard ? `Back to ${cur.name}` : `Play ${cur.name}`;
	});
	const skippable = $derived((void game.v, R.skipTag(run) !== null));
	const W = 820;
	const left = $derived(L.orientation === 'portrait' ? (L.W - Math.min(W, L.W - 40)) / 2 : L.sidebar.w + (L.W - L.sidebar.w - W) / 2);
</script>

<div class="scrim"></div>
<div
	class="panel overview"
	class:accent={boss && R.bossActive(run)}
	style:left="{left}px"
	style:top="{L.orientation === 'portrait' ? L.sidebar.h + 40 : 90}px"
	style:width="{Math.min(W, L.W - 40)}px"
	role="dialog"
	aria-label="Table {table} of {R.TABLES}"
>
	<div class="top">
		<h2>Table {table} of {R.TABLES}</h2>
		<span class="squares">
			{#each { length: R.TABLES }, i (i)}<span class="sq" class:done={i + 1 < table} class:now={i + 1 === table}></span>{/each}
		</span>
	</div>
	<p class="lead">Win all three boards to move on to the next table. Each board's goal must be reached before its hands run out.</p>
	<div class="boards">
		{#each boards as x (x.b)}
			<div class="board" class:won={x.won} class:now={x.now} class:boss={x.isBoss}>
				<div class="bhead"><span class="bname">{x.name}</span><span class="state">{x.skipped ? 'SKIPPED' : x.won ? 'WON' : x.now ? 'NOW' : 'UP NEXT'}</span></div>
				<div class="glabel">Goal</div>
				<div class="goal">{num(x.target)}</div>
				<div class="meta"><span class:short={x.hands < 3}>{x.hands} hands</span><span class="brass">Pays ${x.reward}+</span></div>
				{#if x.isBoss && boss}
					<div class="rule"></div>
					<div class="btag">BOSS</div>
					<div class="bossname">{boss.name}</div>
					<div class="bosstext">{boss.text}</div>
				{:else}
					<div class="note">{x.skipped ? 'Skipped for its tag.' : x.won ? 'Done.' : x.now ? "You're here." : 'Standard rules.'}</div>
				{/if}
				{#if x.tag && !x.won && !x.skipped}
					{@const t = tagsLib.TAGS[x.tag]}
					<div class="tagbox">
						<div class="tagline"><Icon name={t.icon} scale={1} /><span>Skip for <b>{t.name}</b></span></div>
						<div class="tagtext">{t.text}.</div>
						{#if x.now && skippable}
							<Button variant="ploy" size="sm" onclick={() => game.skipBoard()} style="width: 100%; margin-top: 4px">Skip {x.name}</Button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
	<div class="foot">
		<span class="brass money">Money ${num(run.money)}</span>
		<Button pulse onclick={() => (game.showOverview = false)} style="width: 260px">{label}</Button>
	</div>
</div>

<style>
	.tagbox {
		margin-top: auto;
		padding-top: 8px;
		border-top: 2px solid var(--panel-edge);
	}
	.tagline {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--ploy-light, #c2adf0);
	}
	.tagtext {
		font-size: 13px;
		color: var(--ink-dim);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 279;
	}
	.overview {
		z-index: 280;
		padding: 22px 28px;
		box-sizing: border-box;
	}
	.overview.accent {
		border-color: var(--bad);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	h2 {
		margin: 0;
		font-size: 34px;
		color: var(--brass);
		text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
	}
	.squares {
		display: inline-flex;
		gap: 4px;
	}
	.sq {
		width: 14px;
		height: 14px;
		background: var(--panel-edge);
	}
	.sq.now {
		background: var(--ink);
	}
	.sq.done {
		background: var(--brass);
	}
	.lead {
		margin: 10px 0 16px;
		font-size: 15px;
		color: var(--ink-dim);
	}
	.boards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		min-height: 300px;
	}
	.board {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px;
		background: var(--panel);
		border: 2px solid var(--panel-edge);
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
		--px-sy: 6px;
		clip-path: var(--px-clip);
	}
	.board.now {
		border: 3px solid var(--brass);
		--px-a: 3px;
		--px-b: 3px;
	}
	.board.boss {
		border: 3px solid var(--bad);
		--px-a: 3px;
		--px-b: 3px;
	}
	.board.won {
		background: var(--bg);
		opacity: 0.7;
	}
	.bhead {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.bname {
		font-size: 22px;
		font-weight: 700;
	}
	.state {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}
	.now .state {
		color: var(--brass);
	}
	.won .state {
		color: var(--good);
	}
	.glabel {
		font-size: 13px;
		color: var(--ink-dim);
	}
	.goal {
		font-size: 34px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		margin-top: -6px;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		font-size: 15px;
		color: var(--ink-dim);
	}
	.short {
		color: var(--bad);
	}
	.brass {
		color: var(--brass);
	}
	.rule {
		height: 2px;
		background: var(--panel-edge);
		margin: 4px 0;
	}
	.btag {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--bad);
	}
	.bossname {
		font-size: 20px;
		font-weight: 700;
	}
	.bosstext {
		font-size: 15px;
		color: var(--ink-dim);
	}
	.note {
		margin-top: auto;
		font-size: 14px;
		color: var(--ink-faint);
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 16px;
	}
	.money {
		font-size: 18px;
	}
</style>
