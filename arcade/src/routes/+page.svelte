<!-- A 1280x720 stage, scaled to fit the window. -->
<script lang="ts">
	import { arcade } from '$lib/app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Felt from '$lib/components/Felt.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Table from '$lib/components/Table.svelte';
	import Panels from '$lib/components/Panels.svelte';
	import Shop from '$lib/components/Shop.svelte';
	import * as sound from '$lib/audio/sound.ts';

	let w = $state(1280),
		h = $state(720);
	const scale = $derived(Math.min(w / 1280, h / 720));
	// The run is mutated in place; `arcade.v` is what changes.
	const run = $derived((void arcade.v, arcade.run));
	const phase = $derived((void arcade.v, arcade.run?.phase));
	const ui = $derived(arcade.ui);
</script>

<!-- Browsers allow sound only after a gesture. -->
<svelte:window bind:innerWidth={w} bind:innerHeight={h} onpointerdown={() => sound.unlock()} onkeydown={() => sound.unlock()} />

<div class="wrap">
	<div class="stage" style:transform="scale({scale})">
		<Felt x={0} w={1280} h={720} />
		{#if arcade.screen === 'menu' || !run || !ui}
			<Menu />
		{:else}
			<Sidebar />
			{#if phase === R.PHASE.SHOP}
				<Shop />
			{:else}
				<Table />
				{#if phase === R.PHASE.PRE}
					<div class="pre"><ui.Pre {run} picked={arcade.picked} act={(a) => arcade.game(a)} v={arcade.v} /></div>
				{:else if phase === R.PHASE.PLAY && !arcade.busy && (void arcade.v, ui.view(run).legal.size)}
					<div class="out"><button onclick={() => arcade.game({ t: 'playOut' })}>Play it out</button></div>
				{/if}
				<Panels />
			{/if}
		{/if}
		{#if arcade.toast}<div class="toast">{arcade.toast}</div>{/if}
	</div>
</div>

<style>
	.wrap {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		overflow: hidden;
	}
	.stage {
		position: relative;
		width: 1280px;
		height: 720px;
		flex: none;
		overflow: hidden;
	}
	.pre {
		position: absolute;
		left: 270px;
		width: 1010px;
		top: 120px;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 90;
	}
	.pre > :global(*) {
		pointer-events: auto;
	}
	.out {
		position: absolute;
		right: 24px;
		top: 420px;
		z-index: 90;
	}
	.out button {
		font: inherit;
		font-size: 16px;
		padding: 6px 14px;
		background: var(--panel-edge);
		color: var(--ink);
		border: none;
		cursor: pointer;
	}
	.toast {
		position: absolute;
		left: 50%;
		top: 20px;
		transform: translateX(-50%);
		padding: 8px 16px;
		background: var(--panel);
		border: 2px solid var(--bad);
		z-index: 200;
	}
</style>
