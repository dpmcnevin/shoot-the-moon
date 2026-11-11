<!-- The club, for any game: wares as cards (relics cream, upgrades and ploys
     tinted) with a price coin; tap one to read it and buy. Your relics to
     sell, a reroll, and the way on. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	const run = $derived((void arcade.v, arcade.run!));
	let picked = $state<number | null>(null);
	const EDGE = ['', '#9fb3a8', '#4fbf7a', '#4a9fe0', '#d9a441'];
	const edge = (it: R.ShopItem) => (it.kind === 'relic' ? EDGE[it.def.rarity] : it.kind === 'ploy' ? '#8e6bd1' : '#d9a441');
	const kind = (it: R.ShopItem) => (it.kind === 'relic' ? 'Relic' : it.kind === 'ploy' ? 'Ploy' : 'Upgrade');
	const text = (it: R.ShopItem) =>
		it.kind === 'upgrade' ? `${it.def.text}: +${it.def.chips} ${run.module.words.chips}, +${it.def.mult} mult a level (now Lv.${run.levels[it.def.key] ?? 1})` : it.def.text;
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="shop" onclick={() => (picked = null)}>
	<div class="head">
		<h1>The Club</h1>
		<div class="money">${run.money}</div>
	</div>
	<div class="wares">
		{#each run.shop?.items ?? [] as it, i (i + it.name + (arcade.v * 0))}
			{@const can = R.canBuy(run, i)}
			<div class="item" class:sel={picked === i} class:sold={it.sold} style:--edge={edge(it)} onclick={(e) => { e.stopPropagation(); if (!it.sold) picked = picked === i ? null : i; }}>
				{#if !it.sold}<div class="coin">${it.cost}</div>{/if}
				<div class="card k-{it.kind}">
					<div class="banner">{kind(it)}</div>
					<div class="art"><Icon name={it.def.icon} scale={4} /></div>
					{#if it.kind === 'relic'}<div class="rarity">{R.RARITY_NAME[it.def.rarity]}</div>{/if}
					<div class="name">{it.name}</div>
					{#if it.sold}<div class="stamp">SOLD</div>{/if}
				</div>
				{#if picked === i && !it.sold}
					<div class="info">
						<h3>{it.name}</h3>
						<p>{text(it)}</p>
						<Button enabled={can[0]} onclick={() => { picked = null; arcade.do({ t: 'buy', slot: i }); }} style="width: 100%">{can[0] ? `Buy $${it.cost}` : can[1]}</Button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	<h3 class="sub">Your relics {run.relics.length}/{R.RELIC_SLOTS}</h3>
	<div class="owned">
		{#each run.relics as r, i}
			<div class="relic" title={r.def.describe?.(r) ?? r.def.text}>
				<div class="rh"><Icon name={r.def.icon} scale={2} /><span>{r.name}</span></div>
				<Button variant="plain" size="sm" onclick={() => arcade.do({ t: 'sell', slot: i })} style="width: 100%">Sell ${Math.max(1, Math.floor(r.cost / 2))}</Button>
			</div>
		{/each}
	</div>
	<div class="foot">
		<Button variant="plain" enabled={run.money >= run.rerollCost} onclick={() => arcade.do({ t: 'reroll' })} style="width: 180px">Reroll ${run.rerollCost}</Button>
		<Button pulse onclick={() => arcade.do({ t: 'leave' })} style="width: 200px">Next board</Button>
	</div>
</div>
{/key}

<style>
	.shop {
		position: absolute;
		left: 270px;
		top: 0;
		width: 1010px;
		height: 720px;
		box-sizing: border-box;
		padding: 18px 30px 24px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		z-index: 110;
	}
	.head {
		display: flex;
		justify-content: space-between;
	}
	h1 {
		margin: 0;
		font-size: 44px;
		color: var(--brass);
	}
	.money {
		font-size: 44px;
		font-weight: 700;
		color: var(--brass);
	}
	.wares {
		height: 270px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
		background: radial-gradient(ellipse at center, var(--felt-light), var(--felt-edge) 80%);
		border: 3px solid var(--brass-dim);
	}
	.item {
		position: relative;
		width: 150px;
		cursor: pointer;
		transition: transform 0.12s;
	}
	.item:hover,
	.item.sel {
		transform: translateY(-8px);
		z-index: 5;
	}
	.item.sold {
		cursor: default;
		transform: none;
	}
	.card {
		position: relative;
		height: 210px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 10px 12px;
		background: #f3ead6;
		color: #2a2418;
		border: 4px solid var(--edge);
		overflow: hidden;
	}
	.card:not(.k-relic) {
		background: color-mix(in srgb, var(--edge) 18%, #f3ead6);
	}
	.banner {
		align-self: stretch;
		margin: 0 -10px;
		padding: 4px 24px 5px;
		background: var(--edge);
		color: #1b1d26;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: center;
	}
	.art {
		flex: 1;
		display: flex;
		align-items: center;
	}
	.rarity {
		font-size: 12px;
		color: color-mix(in srgb, var(--edge) 60%, #1b1d26);
	}
	.name {
		font-size: 16px;
		font-weight: 700;
		text-align: center;
	}
	.coin {
		position: absolute;
		right: -12px;
		top: -14px;
		z-index: 3;
		min-width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brass);
		box-shadow: inset 0 -3px 0 var(--brass-dim);
		color: #2a2418;
		font-weight: 700;
	}
	.sold .card {
		filter: grayscale(0.8) brightness(0.5);
	}
	.stamp {
		position: absolute;
		top: 45%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-14deg);
		font-size: 28px;
		font-weight: 700;
		border: 3px solid #2a2418;
		padding: 0 8px;
	}
	.info {
		position: absolute;
		left: 50%;
		top: calc(100% + 12px);
		transform: translateX(-50%);
		width: 280px;
		padding: 10px 14px 12px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		cursor: default;
		z-index: 20;
	}
	.info h3 {
		margin: 0 0 4px;
	}
	.info p {
		margin: 0 0 10px;
		color: var(--ink-dim);
		font-size: 15px;
	}
	.sub {
		margin: 0;
	}
	.owned {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
		min-height: 96px;
	}
	.relic {
		padding: 8px 10px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 6px;
	}
	.rh {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 14px;
	}
	.foot {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
	}
</style>
