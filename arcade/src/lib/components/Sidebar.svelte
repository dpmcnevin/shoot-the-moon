<!-- The run at a glance, for any game: progress, the goal, money, relics,
     ploys and upgrade levels. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Icon from './Icon.svelte';
	import Shine from './Shine.svelte';
	import { TAGS } from '$kit/src/run/content.ts';
	import Button from './Button.svelte';
	import * as sound from '../audio/sound.ts';
	import SpeedSlider from './SpeedSlider.svelte';
	import { settings } from '../settings.svelte.ts';

	const run = $derived((void arcade.v, arcade.run!));
	const m = $derived(run.module);
	const levels = $derived(m.upgrades);
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
<aside>
	<div class="title">{m.title.toUpperCase()}</div>
	<div class="row"><span>{m.words.table} {run.table} of {m.tables}</span><span class="dim">{R.boardName(run)}</span></div>
	<div class="goal">
		<div class="row dim"><span>Goal</span><span>Scored</span></div>
		<div class="row big"><span>{run.target}</span><span class:good={run.score >= run.target}>{run.score}</span></div>
		<div class="bar"><div style:width="{Math.min(100, (100 * run.score) / Math.max(1, run.target))}%"></div></div>
		<div class="row dim"><span>{m.words.hands} left</span><span>{run.handsLeft} of {m.handsPerBoard}</span></div>
	</div>
	<div class="row"><span class="dim">Money</span><span class="money">${run.money}</span></div>
	{#if run.boss}
		<div class="boss" class:on={R.bossActive(run)} title={run.boss.text}>
			<span class="bl">{R.bossActive(run) ? 'Boss now' : `${m.boardName?.({ ...run, board: m.boardsPerTable }) ?? 'Last board'} boss`}</span>
			<span class="bn">{run.boss.name}</span>
			<span class="bt">{run.boss.text}</span>
		</div>
	{/if}
	{#if R.skipTag(run)}
		{@const tag = TAGS[R.skipTag(run)!]}
		<Button variant="ploy" size="sm" title={tag.text} onclick={() => arcade.do({ t: 'skip' })} style="width: 100%">Skip board for {tag.name}</Button>
	{/if}

	<div class="sub">Levels</div>
	{#each levels as u}
		<div class="lv">{#if u.glyph}<span class="glyph">{u.glyph}</span>{:else}<Icon name={u.icon} scale={1} />{/if}<span>{u.name}</span><span class="dim">Lv.{run.levels[u.key] ?? 1}</span></div>
	{/each}

	<div class="sub">Ploys {run.ploys.length}/{R.PLOY_SLOTS}</div>
	<div class="ploys">
		{#each run.ploys as key, i}
			{@const def = R.ployDef(run, key)!}
			{@const ok = R.canUsePloy(run, i)}
			<Button variant="ploy" size="sm" enabled={ok[0]} title={def.text} onclick={() => arcade.do({ t: 'ploy', slot: i })} style="width: 100%">{def.name}</Button>
		{/each}
	</div>

	<div class="sub">Relics {R.relicSlotsUsed(run)}/{R.relicSlots(run)}</div>
	<div class="relics">
		{#each run.relics as r}
			<div class="relic" class:jinxed={R.bossActive(run) && run.jinxed === r.key} title="{r.name}: {r.def.describe?.(r) ?? r.def.text}{R.bossActive(run) && run.jinxed === r.key ? ' (jinxed this board)' : ''}"><Shine edition={r.edition}><Icon name={r.def.icon} scale={2} /></Shine></div>
		{/each}
	</div>

	<div class="grow"></div>
	<SpeedSlider />
	<div class="toggles">
		<Button variant="plain" size="sm" onclick={() => sound.toggleSfx()} style="width: 100%">Sound {settings.sfx ? 'on' : 'off'}</Button>
		<Button variant="plain" size="sm" onclick={() => sound.toggleMusic()} style="width: 100%">Music {settings.music ? 'on' : 'off'}</Button>
	</div>
	<div class="foot">
		<span class="dim">Seed {run.seed} · <button class="link" onclick={() => arcade.downloadLog()}>log</button></span>
		<Button variant="plain" size="sm" onclick={() => (arcade.overlay = 'help')}>Help</Button>
		<Button variant="plain" size="sm" onclick={() => arcade.toMenu()}>Menu</Button>
	</div>
</aside>
{/key}

<style>
	aside {
		position: absolute;
		left: 0;
		top: 0;
		width: var(--sw);
		height: var(--sh);
		box-sizing: border-box;
		padding: 14px 16px;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 100;
	}
	/* Portrait: the sidebar runs along the top, in columns. */
	:global(.stage.portrait) aside {
		flex-wrap: wrap;
		align-content: flex-start;
		column-gap: 18px;
		border-right: none;
		border-bottom: 3px solid var(--brass-dim);
	}
	:global(.stage.portrait) aside > :global(*) {
		width: 236px;
		box-sizing: border-box;
	}
	:global(.stage.portrait) .foot {
		flex-wrap: wrap;
	}
	:global(.stage.portrait) .grow {
		display: none;
	}
	.title {
		color: var(--brass);
		font-size: 22px;
		font-weight: 700;
	}
	.row {
		display: flex;
		justify-content: space-between;
	}
	.dim {
		color: var(--ink-dim);
	}
	.goal {
		padding: 8px 10px;
		border: 2px solid var(--brass-dim);
		background: var(--panel);
	}
	.big {
		font-size: 30px;
		font-weight: 700;
	}
	.good {
		color: var(--good);
	}
	.bar {
		height: 6px;
		background: var(--bg);
		margin: 4px 0;
	}
	.bar div {
		height: 100%;
		background: var(--good);
	}
	.money {
		color: var(--brass);
		font-size: 26px;
		font-weight: 700;
	}
	.boss {
		display: flex;
		flex-direction: column;
		padding: 6px 8px;
		border: 2px solid var(--panel-edge);
		background: var(--panel);
		font-size: 13px;
	}
	.boss.on {
		border-color: var(--bad);
	}
	.bl {
		color: var(--ink-dim);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
	}
	.bn {
		color: var(--bad);
		font-size: 16px;
	}
	.bt {
		color: var(--ink-dim);
	}
	.sub {
		margin-top: 6px;
		color: var(--ink-dim);
		font-size: 14px;
	}
	.lv {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 14px;
	}
	.lv span:nth-child(2) {
		flex: 1;
	}
	.glyph {
		width: 18px;
		text-align: center;
		color: var(--brass);
	}
	.ploys {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.relics {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.relic {
		padding: 3px;
		background: var(--panel);
	}
	.relic.jinxed {
		opacity: 0.3;
		outline: 2px solid var(--bad);
	}
	.link {
		font: inherit;
		background: none;
		border: none;
		padding: 0;
		color: var(--ink-dim);
		text-decoration: underline;
		cursor: pointer;
	}
	.toggles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.grow {
		flex: 1;
	}
	.foot {
		gap: 6px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
	}
</style>
