<!-- The overlays over the table, for any game: the hand's score, the board
     won, and the end of the run. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Button from './Button.svelte';

	const run = $derived((void arcade.v, arcade.run!));
	const m = $derived(run.module);
	const b = $derived(run.result);
	const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
{#if run.phase === R.PHASE.SCORED && b}
	<div class="panel" class:bad={!b.made}>
		<h2>{b.title}</h2>
		{#each b.lines as l}
			<div class="line">
				<span>{l.label}</span>
				<span>
					{#if l.chips}<span class="chips">{l.chips > 0 ? '+' : ''}{fmt(l.chips)}</span>{/if}
					{#if l.mult}<span class="mult">+{fmt(l.mult)}</span>{/if}
					{#if l.xmult && l.xmult !== 1}<span class="mult">x{fmt(l.xmult)}</span>{/if}
					{#if l.money}<span class="money">+${l.money}</span>{/if}
				</span>
			</div>
		{/each}
		<div class="total">
			<span class="pill chips-bg">{fmt(b.chips)}</span> x <span class="pill mult-bg">{fmt(b.mult)}</span>
			<span class="eq">= {b.total}</span>
		</div>
		<div class="dim">Board {run.score} / {run.target} · {run.handsLeft} {m.words.hands} left</div>
		<Button pulse onclick={() => arcade.do({ t: 'next' })} style="width: 240px">
			{run.score >= run.target ? 'Board won!' : run.handsLeft <= 0 ? 'Out of ' + m.words.hands : 'Next ' + m.words.hand}
		</Button>
	</div>
{:else if run.phase === R.PHASE.WON && run.lastPayout}
	{@const p = run.lastPayout}
	<div class="panel">
		<h2>{R.boardName(run)} won</h2>
		<div class="line"><span>Board</span><span class="money">${p.board}</span></div>
		<div class="line"><span>{m.words.hands} left over</span><span class="money">${p.unused}</span></div>
		<div class="line"><span>Interest</span><span class="money">${p.interest}</span></div>
		{#if p.relics}<div class="line"><span>Relics</span><span class="money">${p.relics}</span></div>{/if}
		<div class="line big"><span>Total</span><span class="money">${p.total}</span></div>
		<Button pulse onclick={() => arcade.do({ t: 'shop' })} style="width: 240px">To the club</Button>
	</div>
{:else if run.phase === R.PHASE.OVER || run.phase === R.PHASE.VICTORY}
	<div class="panel">
		<h2>{run.phase === R.PHASE.VICTORY ? 'Victory!' : 'Run over'}</h2>
		<div class="dim">{m.words.table} {run.table}, {R.boardName(run)} · {run.stats.hands} {m.words.hands} · best {run.stats.best}</div>
		<Button onclick={() => arcade.start(m.id)} style="width: 200px">New run</Button>
		<Button variant="plain" onclick={() => arcade.toMenu()} style="width: 200px">Menu</Button>
	</div>
{/if}
{/key}

<style>
	.panel {
		position: absolute;
		left: calc(270px + 505px);
		top: 120px;
		transform: translateX(-50%);
		width: 560px;
		box-sizing: border-box;
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--good);
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: stretch;
		z-index: 120;
	}
	.panel.bad {
		border-color: var(--bad);
	}
	.panel :global(.btn) {
		align-self: flex-end;
	}
	h2 {
		margin: 0 0 6px;
		color: var(--brass);
		font-size: 30px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		font-size: 17px;
	}
	.big {
		font-size: 21px;
		font-weight: 700;
	}
	.chips {
		color: var(--chips);
		margin-left: 8px;
	}
	.mult {
		color: var(--mult);
		margin-left: 8px;
	}
	.money {
		color: var(--brass);
		margin-left: 8px;
	}
	.total {
		margin-top: 8px;
		font-size: 26px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pill {
		padding: 0 10px;
	}
	.chips-bg {
		background: var(--chips);
	}
	.mult-bg {
		background: var(--mult);
	}
	.eq {
		margin-left: auto;
	}
	.dim {
		color: var(--ink-dim);
	}
</style>
