<!-- The run's status: table and board, target and score, this hand's pass
     and points, money, upgrade levels and relics. A column in landscape, a
     strip above the table in portrait. -->
<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as H from '$engine/rules/hearts.ts';
	import * as R from '$engine/game/run.ts';
	import * as relics from '$engine/game/relics.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { C, css } from '$engine/ui/theme.ts';
	import Icon from './Icon.svelte';
	import SealBadge from './SealBadge.svelte';
	import * as seals from '$engine/game/seals.ts';
	import * as cards from '$engine/rules/cards.ts';
	import * as bosses from '$engine/game/bosses.ts';
	import Shine from './Shine.svelte';
	import SpeedSlider from './SpeedSlider.svelte';
	import { editionColor } from './editions.ts';

	/** Open the info card for something in the sidebar, beside where it was clicked. */
	function inspect(e: MouseEvent, info: { kind: string; title: string; text: string; note?: string; color: string }) {
		const stage = (e.currentTarget as HTMLElement).closest('.stage') as HTMLElement;
		const r = stage.getBoundingClientRect();
		const k = stage.offsetWidth / r.width;
		game.inspect = { ...info, y: (e.clientY - r.top) * k };
	}
	function relicNote(relic: relics.Relic, isJinxed: boolean): string {
		const notes: string[] = [];
		const ed = relic.edition ? relics.EDITIONS[relic.edition] : null;
		if (ed) notes.push(ed.name + ': ' + ed.text);
		if (isJinxed) notes.push('Jinxed: does nothing this board');
		notes.push('Sells for $' + Math.max(1, Math.floor(relic.cost / 2)));
		return notes.join('\n');
	}

	const L = $derived(game.layout);
	const portrait = $derived(L.orientation === 'portrait');
	const run = $derived(game.run!);
	const hand = $derived(game.hand);
	const boardWon = $derived(run.phase === PHASE.BOARD_WON || run.phase === PHASE.SHOP || run.phase === PHASE.VICTORY);
	const table = $derived(Math.min(run.table, R.TABLES));
	const boss = $derived(run.boss ? bosses.bossAt(run.boss, run.balance) : null);
	const bossNow = $derived(R.bossActive(run));
	const jinxed = $derived(bossNow && run.boss === 'jinx' ? run.jinxed : null);
	const slots = $derived(R.relicSlots(run));
	const used = $derived(R.relicSlotsUsed(run));

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
	const packPoints = $derived.by(() => {
		void game.v;
		return run.pack.reduce((n, c) => n + seals.cardPoints(run.seals, c), 0);
	});
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
		<button class="progress" onclick={() => (game.showOverview = true)} title="Show this table's boards and boss">
			<div class="row">
				<span>Table {table} of {R.TABLES}</span>
				<span class="tables">
					{#each { length: R.TABLES }, i (i)}
						<span class="tsq" class:done={i + 1 < table || (i + 1 === table && boardWon && run.board === R.BOARDS_PER_TABLE)} class:now={i + 1 === table}></span>
					{/each}
				</span>
			</div>
			<div class="chips">
				{#each { length: R.BOARDS_PER_TABLE }, i (i)}
					{@const b = i + 1}
					{@const done = b < run.board || (b === run.board && boardWon)}
					<span class="chip" class:done class:now={b === run.board && !done}>{b === R.BOARDS_PER_TABLE ? 'High Board' : 'Board ' + b}</span>
				{/each}
			</div>
			{#if boss}
				<div class="boss" class:active={bossNow}>
					<span class="boss-tag">{bossNow ? 'BOSS NOW' : 'HIGH BOARD BOSS'}</span> <span class="boss-name">{boss.name}</span>
					{#if bossNow}<div class="boss-text">{boss.text}</div>{/if}
				</div>
			{/if}
		</button>
	</section>

	<section class="box">
		<div class="row">
			<div><div class="label">{R.boardName(run)} goal</div><div class="big">{num(run.target)}</div></div>
			<div class="right"><div class="label">Scored</div><div class="big" class:good={reached}>{num(score.current)}</div></div>
		</div>
		<div class="bar">
			<div class="fill" style:width="{Math.min(100, (100 * score.current) / Math.max(1, run.target))}%" style:background={reached ? 'var(--good)' : 'var(--brass)'}></div>
		</div>
		<div class="deals">
			<span class="tiny">Hands left</span>
			{#each { length: run.handsThisBoard }, i (i)}<span class="dot" class:used={i + 1 > run.handsLeft}></span>{/each}
			<span class="hands-n" class:bad={run.handsLeft <= 1 && !reached}>{run.handsLeft} of {run.handsThisBoard}</span>
		</div>
	</section>

	<section class="this-hand">
		<div class="label">This hand · <span class="ink">{passLabel}</span></div>
		<div class="pack-line">Pack {run.pack.length} · {packPoints} points{hand.kitty.length ? ` · kitty ${hand.kitty.length}` : ''}</div>
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
				<button
					class="level"
					onclick={(e) =>
						inspect(e, {
							kind: 'Upgrade, level ' + lvl,
							title: u.name,
							text: u.text,
							note: lvl > 1 ? 'Now +' + b[0] + ' chips, +' + b[1].toFixed(1) + ' mult' : 'Not levelled yet',
							color: 'var(--brass)'
						})}
				>
					<Icon name={u.icon} scale={1} />
					<span class:brass={lvl > 1} class:faint={lvl <= 1}>{u.name.replace('The ', '')} {lvl}</span>
				</button>
			{/each}
		</div>
	</section>

	{#if Object.keys(run.seals).length > 0}
		<section class="seals">
			<div class="label">Seals</div>
			<div class="seal-list">
				{#each Object.entries(run.seals) as [id, key] (id)}
					{@const c = run.pack.find((x) => String(x.id) === id) ?? cards.newDeck().find((x) => cards.code(x) === id)}
					{#if c}
						<button
							class="sealed"
							onclick={(e) => inspect(e, { kind: 'Seal on ' + cards.name(c), title: seals.SEALS[key].name, text: seals.SEALS[key].text, color: 'var(--ploy)' })}
						>
							<SealBadge seal={key} size={14} /><span style:color={cards.SUITS[c.suit].red ? 'var(--bad)' : 'var(--ink)'}>{cards.name(c)}</span>
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<section class="relics">
		<div class="label">Relics {used}/{slots}</div>
		<div class="relic-list">
			{#each { length: run.relics.length + Math.max(0, slots - used) }, i (i)}
				{@const relic = run.relics[i]}
				{#if relic}
					{@const isJinxed = jinxed === relic.key}
					{@const ed = relic.edition ? relics.EDITIONS[relic.edition] : null}
					<button
						class="relic"
						onclick={(e) =>
							inspect(e, {
								kind: relics.RARITY_NAME[relic.def.rarity] + ' relic',
								title: relic.name,
								text: relics.textFor((void game.v, relic), run.balance),
								note: relicNote(relic, isJinxed),
								color: css(C.rarity[relic.def.rarity])
							})}
					>
						<span style:filter={isJinxed ? 'grayscale(1)' : null}><Shine edition={relic.edition}><Icon name={relic.def.icon} scale={1} /></Shine></span>
						<span class="rarity" style:background={css(C.rarity[relic.def.rarity])}></span>
						<span class="relic-text">
							{#if isJinxed}<span class="tag" style:color="var(--bad)">JINXED</span>
							{:else if ed}<span class="tag" style:color={editionColor(relic.edition)}>{ed.name.toUpperCase()}</span>{/if}
							<span class="name" class:struck={isJinxed}>{relic.name}</span>
						</span>
					</button>
				{:else}
					<div class="relic empty"></div>
				{/if}
			{/each}
		</div>
	</section>

	<div class="foot">
		{#if !portrait}<SpeedSlider width={L.sidebar.w - 36} />{/if}
		<div class="hint">Seed {run.seed}</div>
	</div>
</aside>

<style>
	.sidebar {
		position: absolute;
		box-sizing: border-box;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		padding: 12px 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 100;
	}
	.sidebar > section {
		flex: none;
	}
	/* The relic list gives way first when the column runs short (a boss's
	   rule showing): empty slots are clipped, never the footer. */
	.sidebar:not(.portrait) > section.relics {
		flex: 0 1 auto;
		min-height: 0;
		overflow: hidden;
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
		clip-path: var(--px-clip);
		padding: 0 12px 6px;
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
		font-size: 26px;
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
		margin: 4px 0;
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
	.pack-line {
		font-size: 12px;
		color: var(--ink-faint);
		margin-top: 2px;
	}
	.points {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		margin-top: 3px;
	}
	.pt {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--panel);
		clip-path: var(--px-clip);
		padding: 1px 0;
	}
	.pt.me {
		box-shadow: inset 0 0 0 2px var(--brass-dim);
	}
	.who {
		font-size: 12px;
		color: var(--ink-dim);
	}
	.n {
		font-size: 18px;
		font-weight: 700;
		color: var(--ink-faint);
	}
	.n.hot {
		color: var(--bad);
	}
	.levels {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		margin-top: 4px;
		font-size: 13px;
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
		gap: 1px;
		margin-top: 4px;
	}
	.relic {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 22px;
		background: var(--panel);
		clip-path: var(--px-clip);
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
	.foot {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.hint {
		font-size: 12px;
		color: var(--ink-faint);
	}
	button.progress,
	button.level,
	button.sealed,
	button.relic {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
	}
	button.relic {
		background: var(--panel);
	}
	button.progress {
		display: block;
		width: 100%;
	}
	.tables {
		display: inline-flex;
		gap: 3px;
		align-items: center;
	}
	.tsq {
		width: 9px;
		height: 9px;
		background: var(--panel-edge);
	}
	.tsq.now {
		background: var(--ink);
	}
	.tsq.done {
		background: var(--brass);
	}
	.chips {
		display: flex;
		gap: 4px;
		margin-top: 6px;
	}
	.chip {
		flex: 1;
		text-align: center;
		font-size: 12px;
		line-height: 20px;
		background: var(--panel);
		color: var(--ink-faint);
		border: 2px solid transparent;
		clip-path: var(--px-clip);
	}
	.chip.now {
		background: var(--brass);
		color: var(--bg);
	}
	.chip.done {
		color: var(--good);
		border-color: var(--good);
	}
	.boss {
		margin-top: 6px;
		padding: 4px 8px;
		background: var(--panel);
		border: 2px solid transparent;
		clip-path: var(--px-clip);
		font-size: 14px;
		color: var(--ink-dim);
	}
	.boss.active {
		border-color: var(--bad);
		color: var(--ink);
	}
	.boss-tag {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.boss.active .boss-tag {
		color: var(--bad);
	}
	.boss-text {
		font-size: 12px;
		color: var(--ink-dim);
		margin-top: 2px;
	}
	.hands-n {
		margin-left: auto;
		font-size: 13px;
		color: var(--ink);
	}
	.hands-n.bad {
		color: var(--bad);
	}
	.relic-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.05;
	}
	.tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.struck {
		text-decoration: line-through;
		text-decoration-color: var(--bad);
		color: var(--ink-faint);
	}

</style>
