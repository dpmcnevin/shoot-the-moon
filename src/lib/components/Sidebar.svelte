<!-- The run's status: table and board, target and score, this hand's pass
     and points, money, upgrade levels and relics. A column in landscape, a
     strip above the table in portrait. -->
<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as H from '../rules/hearts.ts';
	import * as R from '../game/run.ts';
	import * as relics from '../game/relics.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { C, css } from '../ui/theme.ts';
	import Icon from './Icon.svelte';
	import SealBadge from './SealBadge.svelte';
	import * as seals from '../game/seals.ts';
	import * as cards from '../rules/cards.ts';

	const L = $derived(game.layout);
	const portrait = $derived(L.orientation === 'portrait');
	const run = $derived(game.run!);
	const hand = $derived(game.hand);

	const pending = $derived(
		run.phase === PHASE.HAND_SCORED && hand.result && (game.trickHold || !game.reveal?.done) ? hand.result.total : 0
	);
	const score = new Tween(0, { duration: 600, easing: cubicOut });
	const money = new Tween(0, { duration: 450, easing: cubicOut });
	$effect(() => {
		score.target = run.score - pending;
	});
	$effect(() => {
		money.target = run.money;
	});
	const reached = $derived(run.score >= run.target);
	const points = $derived.by(() => {
		void game.v;
		return hand.state ? seals.pointsTaken(run.seals, hand.state.taken) : [0, 0, 0, 0, 0];
	});
	const passLabel = $derived(
		hand.passDir === 'hold' ? 'No passing' : `Pass ${hand.passDir} to ${H.SEAT_NAMES[H.passTarget(H.PLAYER, hand.passDir)]}`
	);
	const ORDER = [3, 4, 1, 2]; // you, then clockwise
</script>

<aside
	class="sidebar"
	class:portrait
	style:left="{L.sidebar.x}px"
	style:top="{L.sidebar.y}px"
	style:width="{L.sidebar.w}px"
	style:height="{L.sidebar.h}px"
>
	<section class="head">
		<h1>SHOOT THE MOON</h1>
		<div class="row"><span>Table {Math.min(run.table, R.TABLES)} of {R.TABLES}</span><span class="dim">{R.boardName(run)}</span></div>
	</section>

	<section class="box">
		<div class="row">
			<div><div class="label">Target</div><div class="big">{num(run.target)}</div></div>
			<div class="right"><div class="label">Scored</div><div class="big" class:good={reached}>{num(score.current)}</div></div>
		</div>
		<div class="bar">
			<div class="fill" style:width="{Math.min(100, (100 * score.current) / Math.max(1, run.target))}%" style:background={reached ? 'var(--good)' : 'var(--brass)'}></div>
		</div>
		<div class="deals">
			<span class="tiny">Hands</span>
			{#each { length: R.HANDS_PER_BOARD }, i (i)}<span class="dot" class:used={i + 1 > run.handsLeft}></span>{/each}
		</div>
	</section>

	<section class="this-hand">
		<div class="label">This hand · <span class="ink">{passLabel}</span></div>
		<div class="points">
			{#each ORDER as s (s)}
				<div class="pt" class:me={s === H.PLAYER}>
					<span class="who">{s === H.PLAYER ? 'You' : H.SEAT_NAMES[s]}</span>
					<span class="n" class:hot={points[s] > 0}>{points[s]}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="money">
		<div class="row">
			<div><div class="label">Money</div><div class="big brass">${num(money.current)}</div></div>
			<div class="right"><div class="label">Interest</div><div class="dim body">+${R.interest(run)}</div></div>
		</div>
		<div class="levels">
			{#each Object.values(R.UPGRADES) as u (u.key)}
				{@const lvl = run.levels[u.key]}
				{@const b = R.upgradeBonus(u.key, lvl)}
				<span class="level" title="{u.name} level {lvl}: +{b[0]} chips, +{b[1].toFixed(1)} mult. {u.text}.">
					<Icon name={u.icon} scale={1} />
					<span class:brass={lvl > 1} class:faint={lvl <= 1}>{u.name.replace('The ', '')} {lvl}</span>
				</span>
			{/each}
		</div>
	</section>

	{#if Object.keys(run.seals).length > 0}
		<section class="seals">
			<div class="label">Seals</div>
			<div class="seal-list">
				{#each Object.entries(run.seals) as [code, key] (code)}
					{@const c = cards.newDeck().find((x) => cards.code(x) === code)!}
					<span class="sealed" title="{seals.SEALS[key].name} on {cards.name(c)}: {seals.SEALS[key].text}">
						<SealBadge seal={key} size={16} /><span style:color={cards.SUITS[c.suit].red ? 'var(--bad)' : 'var(--ink)'}
							>{cards.name(c)}</span
						>
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="relics">
		<div class="label">Relics {run.relics.length}/{R.RELIC_SLOTS}</div>
		<div class="relic-list">
			{#each { length: R.RELIC_SLOTS }, i (i)}
				{@const relic = run.relics[i]}
				{#if relic}
					<div class="relic" title="{relic.name} ({relics.RARITY_NAME[relic.def.rarity]})&#10;{relics.textFor((void game.v, relic))}">
						<Icon name={relic.def.icon} scale={2} />
						<span class="rarity" style:background={css(C.rarity[relic.def.rarity])}></span>
						<span class="name">{relic.name}</span>
					</div>
				{:else}
					<div class="relic empty"></div>
				{/if}
			{/each}
		</div>
	</section>

	<div class="hint">Seed {run.seed} · M: music {settings.music ? 'on' : 'off'}</div>
</aside>

<style>
	.sidebar {
		position: absolute;
		box-sizing: border-box;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		padding: 14px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		z-index: 100;
	}
	.sidebar > section {
		flex: none;
	}
	.sidebar.portrait {
		border-right: none;
		border-bottom: 3px solid var(--brass-dim);
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		grid-template-rows: auto auto 1fr;
		column-gap: 16px;
		row-gap: 6px;
		padding-top: max(12px, env(safe-area-inset-top));
	}
	.portrait .relics {
		grid-row: 1 / span 3;
		grid-column: 3;
	}
	.portrait .hint {
		display: none;
	}
	h1 {
		margin: 0;
		font-size: 19px;
		letter-spacing: 0.05em;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 6px;
		margin-top: 6px;
	}
	.head .row {
		font-size: 16px;
	}
	.right {
		text-align: right;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.ink {
		color: var(--ink);
	}
	.faint {
		color: var(--ink-faint);
	}
	.brass {
		color: var(--brass);
	}
	.good {
		color: var(--good) !important;
	}
	.box {
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		border-radius: 10px;
		padding: 2px 12px 8px;
		margin: 0 -6px;
	}
	.label {
		font-size: 14px;
		color: var(--ink-dim);
	}
	.tiny {
		font-size: 12px;
	}
	.big {
		font-size: 28px;
		font-weight: 700;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		font-variant-numeric: tabular-nums;
	}
	.body {
		font-size: 17px;
		margin-top: 4px;
	}
	.bar {
		height: 10px;
		background: var(--bg);
		border-radius: 5px;
		overflow: hidden;
		margin: 6px 0;
	}
	.fill {
		height: 100%;
	}
	.deals {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-dim);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--brass);
	}
	.dot.used {
		background: var(--panel-edge);
	}
	.points {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		margin-top: 6px;
	}
	.pt {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--panel);
		border-radius: 6px;
		padding: 4px 0;
	}
	.pt.me {
		box-shadow: inset 0 0 0 1px var(--brass-dim);
	}
	.who {
		font-size: 12px;
		color: var(--ink-dim);
	}
	.n {
		font-size: 20px;
		font-weight: 700;
		color: var(--ink-faint);
	}
	.n.hot {
		color: var(--bad);
	}
	.levels {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 8px;
		font-size: 14px;
	}
	.level {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.seal-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		margin-top: 4px;
		font-size: 14px;
		font-weight: 700;
	}
	.sealed {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.relic-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 4px;
	}
	.relic {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		background: var(--panel);
		border-radius: 5px;
		margin: 0 -4px;
		font-size: 14px;
		overflow: hidden;
	}
	.relic.empty {
		background: var(--bg);
	}
	.rarity {
		width: 3px;
		height: 24px;
		flex: none;
	}
	.relic .name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hint {
		margin-top: auto;
		font-size: 12px;
		color: var(--ink-faint);
	}
</style>
