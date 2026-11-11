<!-- A hand's score, for any game: the lines come in one by one while chips
     and mult count up, then the total lands, on fire if this one hand beat
     the board's goal. A click skips to the end. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale as pop } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { arcade } from '../app.svelte.ts';
	import { fx } from '../fx.svelte.ts';
	import { hex } from '$kit/src/core/ui/theme.ts';
	import * as sound from '../audio/sound.ts';
	import { editionColor } from './editions.ts';
	import Button from './Button.svelte';

	const run = arcade.run!;
	const m = run.module;
	const b = run.result!;
	const STEP = 280;

	let shown = $state(0);
	const done = $derived(shown >= b.lines.length);
	const chips = new Tween(0, { duration: 220, easing: cubicOut });
	const mult = new Tween(1, { duration: 220, easing: cubicOut });
	const onFire = b.made && b.total >= run.target && b.total > 0;

	/** Chips and mult after the first n lines. */
	function upTo(n: number): [number, number] {
		let c = 0,
			x = 1;
		for (const l of b.lines.slice(0, n)) {
			c += l.chips ?? 0;
			x += l.mult ?? 0;
			if (l.xmult) x *= l.xmult;
		}
		return n >= b.lines.length ? [b.chips, b.mult] : [c, x];
	}

	function reveal(n: number) {
		shown = n;
		const [c, x] = upTo(n);
		chips.target = c;
		mult.target = x;
	}

	let timer: ReturnType<typeof setInterval> | null = null;
	function land() {
		if (timer) clearInterval(timer);
		timer = null;
		reveal(b.lines.length);
		if (!b.made) return sound.play('down');
		sound.play('total');
		if (onFire) {
			fx.burst(1080, 470, 46, [hex('#e8c873'), hex('#e8772e'), hex('#e0604f')], 340, { life: 1.1, size: 8 });
			fx.shake(6);
		} else if (b.total > 0) fx.burst(1080, 470, 14, [hex('#d9a441'), hex('#ece6d6')], 200, { life: 0.7, size: 6 });
	}

	onMount(() => {
		timer = setInterval(() => {
			if (shown >= b.lines.length) return land();
			const l = b.lines[shown];
			sound.play(l.mult || l.xmult ? 'mult' : 'tick', { pitch: 1 + shown * 0.04, volume: 0.7 });
			reveal(shown + 1);
		}, STEP);
		return () => timer && clearInterval(timer);
	});

	const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));
	const big = (n: number) => Math.round(n).toLocaleString();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="panel" class:bad={!b.made} onclick={() => !done && land()}>
	<h2>{b.title}</h2>
	<div class="lines">
		{#each b.lines.slice(0, shown) as l}
			<div class="line" in:fly={{ x: -24, duration: 200, easing: cubicOut }}>
				<span style:color={l.edition ? editionColor(l.edition) : ''}>{l.label}</span>
				<span>
					{#if l.chips}<span class="chips">{l.chips > 0 ? '+' : ''}{fmt(l.chips)}</span>{/if}
					{#if l.mult}<span class="mult">+{fmt(l.mult)}</span>{/if}
					{#if l.xmult && l.xmult !== 1}<span class="mult">x{fmt(l.xmult)}</span>{/if}
					{#if l.money}<span class="money">+${l.money}</span>{/if}
				</span>
			</div>
		{/each}
	</div>
	<div class="total">
		<span class="pill chips-bg">{big(chips.current)}</span>
		<span class="x">x</span>
		<span class="pill mult-bg">{mult.current.toFixed(2)}</span>
		{#if done}
			<span class="eq" class:fire={onFire} in:pop={{ start: 1.6, duration: 320, easing: backOut }}>
				{#if onFire}
					<span class="flames">{#each [0, 1, 2, 3] as i}<span class="flame" style:--i={i}></span>{/each}</span>
				{/if}
				<span class="num">{b.made ? big(b.total) : 0}</span>
			</span>
		{/if}
	</div>
	<div class="dim">{m.words.table} {run.table} · goal {run.target.toLocaleString()} · scored {run.score.toLocaleString()} · {run.handsLeft} {m.words.hands} left</div>
	{#if done}
		<div class="go" in:fly={{ y: 10, duration: 200 }}>
			<Button pulse onclick={() => arcade.do({ t: 'next' })} style="width: 240px">
				{run.score >= run.target ? 'Board won!' : run.handsLeft <= 0 ? 'Out of ' + m.words.hands : 'Next ' + m.words.hand}
			</Button>
		</div>
	{/if}
</div>

<style>
	.panel {
		position: absolute;
		left: var(--tcx);
		top: calc(var(--ty) + 110px);
		transform: translateX(-50%);
		width: 580px;
		box-sizing: border-box;
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--good);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 120;
		cursor: default;
	}
	.panel.bad {
		border-color: var(--bad);
	}
	h2 {
		margin: 0 0 6px;
		color: var(--brass);
		font-size: 30px;
	}
	.lines {
		min-height: 120px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		font-size: 17px;
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
		height: 56px;
		font-size: 30px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pill {
		padding: 2px 14px;
		min-width: 60px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.chips-bg {
		background: var(--chips);
	}
	.mult-bg {
		background: var(--mult);
	}
	.x {
		color: var(--ink-dim);
	}
	.eq {
		position: relative;
		margin-left: auto;
		font-size: 38px;
	}
	.eq.fire .num {
		position: relative;
		padding: 0 14px;
		background: linear-gradient(#e8772e, var(--bad));
	}
	.num {
		position: relative;
		z-index: 1;
	}
	.flames {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 30px;
		height: 40px;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}
	.flame {
		width: 13px;
		height: 30px;
		background: linear-gradient(to top, var(--bad) 0 34%, #e8772e 34% 68%, var(--brass) 68% 100%);
		clip-path: polygon(50% 0, 85% 14%, 100% 30%, 100% 100%, 0 100%, 0 30%, 15% 14%);
		animation: flicker 0.36s steps(3) infinite alternate;
		animation-delay: calc(var(--i) * -0.11s);
	}
	@keyframes flicker {
		from {
			height: 24px;
		}
		to {
			height: 38px;
		}
	}
	.dim {
		color: var(--ink-dim);
	}
	.go {
		align-self: flex-end;
	}
</style>
