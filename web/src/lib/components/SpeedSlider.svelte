<!-- Play speed, as a row of pixel blocks between a tortoise and a hare. -->
<script lang="ts">
	import { settings, SPEED_MIN, SPEED_MAX, SPEED_STEP } from '../ui/settings.svelte.ts';
	let { width = 260 }: { width?: number } = $props();

	const count = Math.round((SPEED_MAX - SPEED_MIN) / SPEED_STEP) + 1;
	const index = $derived(Math.round((settings.speed - SPEED_MIN) / SPEED_STEP));
	const label = $derived(Number.isInteger(settings.speed) ? `${settings.speed}x` : `${settings.speed}x`);
	let track: HTMLDivElement;
	let dragging = false;

	function setFrom(e: PointerEvent) {
		const r = track.getBoundingClientRect();
		const i = Math.max(0, Math.min(count - 1, Math.floor(((e.clientX - r.left) / r.width) * count)));
		settings.setSpeed(SPEED_MIN + i * SPEED_STEP);
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') settings.setSpeed(settings.speed + SPEED_STEP);
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') settings.setSpeed(settings.speed - SPEED_STEP);
		else return;
		e.preventDefault();
	}
	const TORTOISE = ['...XXXX....', '..XXXXXX.XX', '.XXXXXXXXXX', 'XXXXXXXXXX.', '.X.X..X.X..'];
	const HARE = ['.......X.X.', '.......XX..', '..XXXXXXXXX', '.XXXXXXXXX.', 'XXXXXXXXX..', '..X....X...'];
</script>

{#snippet sprite(rows: string[])}
	<svg width={rows[0].length * 2} height={rows.length * 2} viewBox="0 0 {rows[0].length} {rows.length}" shape-rendering="crispEdges" aria-hidden="true">
		{#each rows as row, y (y)}
			{#each row.split('') as ch, x (x)}
				{#if ch === 'X'}<rect {x} {y} width="1" height="1" fill="var(--ink-dim)" />{/if}
			{/each}
		{/each}
	</svg>
{/snippet}

<div class="speed" style:width="{width}px">
	<div class="head"><span class="dim">Speed</span><span>{label}</span></div>
	<div class="row">
		{@render sprite(TORTOISE)}
		<div
			class="track"
			bind:this={track}
			role="slider"
			tabindex="0"
			aria-label="Play speed"
			aria-valuemin={SPEED_MIN}
			aria-valuemax={SPEED_MAX}
			aria-valuenow={settings.speed}
			aria-valuetext={label}
			onkeydown={key}
			onpointerdown={(e) => {
				dragging = true;
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
				setFrom(e);
			}}
			onpointermove={(e) => dragging && setFrom(e)}
			onpointerup={() => (dragging = false)}
		>
			{#each { length: count }, i (i)}
				<span class="block" class:on={i <= index} class:thumb={i === index}></span>
			{/each}
		</div>
		{@render sprite(HARE)}
	</div>
</div>

<style>
	.speed {
		font-size: 14px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 2px;
	}
	.dim {
		color: var(--ink-dim);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.track {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 2px;
		height: 18px;
		cursor: pointer;
		touch-action: none;
		outline: none;
	}
	.track:focus-visible {
		outline: 2px solid var(--brass);
		outline-offset: 2px;
	}
	.block {
		flex: 1;
		height: 8px;
		background: var(--panel-edge);
	}
	.block.on {
		background: var(--brass);
	}
	.block.thumb {
		height: 18px;
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.35);
	}
</style>
