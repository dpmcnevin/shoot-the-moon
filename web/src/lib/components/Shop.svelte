<!-- The club: the wares laid out on the baize as cards, each with its price
     coin (tap or hover one to read it and buy), your relics to sell, a reroll
     and the way to the next board. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import * as R from '$engine/game/run.ts';
	import * as relics from '$engine/game/relics.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { C, css } from '$engine/ui/theme.ts';
	import Icon from './Icon.svelte';
	import Shine from './Shine.svelte';
	import { editionColor } from './editions.ts';
	import Button from './Button.svelte';
	import SealBadge from './SealBadge.svelte';
	import CardPicker from './CardPicker.svelte';
	import BundleOpen from './BundleOpen.svelte';
	import * as ploysLib from '$engine/game/ploys.ts';
	import * as cards from '$engine/rules/cards.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';

	const L = $derived(game.layout);
	const portrait = $derived(L.orientation === 'portrait');
	const run = $derived(game.run!);
	const items = $derived.by(() => {
		void game.v;
		return run.shop!.items.map((it) => ({ ...it }));
	});
	const money = new Tween(0, { duration: 450, easing: cubicOut });
	$effect(() => {
		money.target = run.money;
	});
	const nextLabel = $derived(
		run.board === R.BOARDS_PER_TABLE && run.table === R.TABLES ? 'Claim victory' : run.board === R.BOARDS_PER_TABLE ? 'Next table' : 'Next board'
	);
	const edge = (it: R.ShopItem) =>
		it.kind === 'relic' ? css(C.rarity[it.def.rarity]) : it.kind === 'seal' ? it.def.color : it.kind === 'pack' ? 'var(--chips)' : it.kind === 'edition' ? editionColor(it.def.key) : it.kind === 'ploy' || it.kind === 'bundle' ? 'var(--ploy)' : 'var(--brass)';
	const kindName = (it: R.ShopItem) =>
		it.kind === 'relic' ? `${relics.RARITY_NAME[it.def.rarity]} relic` : it.kind === 'edition' ? 'Card edition' : it.kind[0].toUpperCase() + it.kind.slice(1);
	let picked = $state<number | null>(null);
	$effect(() => {
		void game.shopRolls;
		picked = null;
	});
	function canBuy(i: number) {
		void game.v;
		return R.canBuy(run, i);
	}
	function buy(i: number, e: MouseEvent) {
		const el = (e.currentTarget as HTMLElement).closest('.item') as HTMLElement;
		const stage = el.closest('.stage') as HTMLElement;
		const a = el.getBoundingClientRect(),
			b = stage.getBoundingClientRect();
		const k = stage.offsetWidth / b.width;
		picked = null;
		game.buy(i, (a.left + a.width / 2 - b.left) * k, (a.top + a.height / 2 - b.top) * k);
	}
</script>

{#snippet face(item: R.ShopItem)}
	{#if item.kind === 'seal'}<SealBadge seal={item.def.key} size={64} />
	{:else if item.kind === 'edition'}<Shine edition={item.def.key}><img class="ed-card" src={cardFace(cards.card(3, 13), false, settings.pixelCards, settings.fourColor)} alt="" /></Shine>
	{:else if item.kind === 'relic'}<Shine edition={item.edition}><Icon name={item.def.icon} scale={4} /></Shine>
	{:else}<Icon name={item.def.icon} scale={4} />{/if}
{/snippet}

{#snippet info(item: R.ShopItem)}
	{#if item.kind === 'relic'}
		<div class="kind" style:color={edge(item)}>
			{#if item.edition}<span class="ed" style:color={editionColor(item.edition)}>{relics.EDITIONS[item.edition].name.toUpperCase()}</span>{/if}
			{relics.RARITY_NAME[item.def.rarity]} relic
		</div>
		<h3>{item.name}</h3>
		<p>{relics.textAt(item.def, run.balance)}</p>
		{#if item.edition}<p style:color={editionColor(item.edition)}>{relics.EDITIONS[item.edition].name}: {relics.EDITIONS[item.edition].text.toLowerCase()}</p>{/if}
	{:else if item.kind === 'upgrade'}
		{@const lvl = run.levels[item.def.key]}
		{@const next = R.upgradeBonus(item.def.key, lvl + 1)}
		<div class="kind brass">Upgrade</div>
		<h3>{item.name}</h3>
		<p>{R.upgradeText(item.def.key, run.balance)}.</p>
		<p class="ink">Lv.{lvl} → Lv.{lvl + 1}: +{next[0]} chips, +{next[1].toFixed(1)} mult</p>
	{:else if item.kind === 'seal'}
		<div class="kind" style:color={item.def.color}>Seal</div>
		<h3>{item.name}</h3>
		<p>{item.def.text}.</p>
		<p class="ink">You choose the card.</p>
	{:else if item.kind === 'edition'}
		<div class="kind" style:color={editionColor(item.def.key)}>Card edition</div>
		<h3>{item.name}</h3>
		<p>{item.def.text}.</p>
		<p class="ink">Lasts the run. You choose the card.</p>
	{:else if item.kind === 'ploy'}
		<div class="kind" style:color="var(--ploy-light)">Ploy</div>
		<h3>{item.name}</h3>
		<p>{item.def.text}.</p>
		<p class="ink">One use. You hold up to {ploysLib.PLOY_SLOTS}; use it from the sidebar.</p>
	{:else if item.kind === 'bundle'}
		<div class="kind" style:color="var(--ploy-light)">Bundle</div>
		<h3>{item.name}</h3>
		<p>{item.def.text}.</p>
	{:else}
		<div class="kind pack">Pack</div>
		<h3>{item.name}</h3>
		<p>{item.def.text}.</p>
		<p class="ink">Changes the pack everyone is dealt from. You choose the card.</p>
	{/if}
{/snippet}

{#snippet ware(item: R.ShopItem, i: number, below: boolean)}
	{@const can = canBuy(i)}
	<div
		class="item"
		class:sel={picked === i}
		class:sold={item.sold}
		style:--edge={edge(item)}
		role="button"
		tabindex="0"
		onclick={(e) => {
			e.stopPropagation();
			picked = picked === i ? null : i;
		}}
		onkeydown={(e) => e.key === 'Enter' && (picked = picked === i ? null : i)}
		in:fly={{ y: 60, duration: 350, delay: i * 80, easing: backOut }}
	>
		<div class="card">
			<div class="kindline">{kindName(item)}</div>
			{#if !item.sold}<div class="coin">${item.cost}</div>{/if}
			<div class="art">{@render face(item)}</div>
			<div class="name">{item.name}</div>
			{#if item.sold}<div class="stamp">SOLD</div>{/if}
		</div>
		{#if !item.sold}
			<div class="info" class:below class:above={!below}>
				<div class="info-box" style:border-color={edge(item)}>
					{@render info(item)}
					<div class="buy">
						<Button enabled={can[0]} sound={false} title={can[0] ? undefined : `Can't buy: ${can[1]}`} onclick={(e) => buy(i, e)} style="width: 100%">
							{can[0] ? `Buy $${item.cost}` : can[1]}
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="shop"
	class:portrait
	style:left="{L.table.x}px"
	style:top="{L.table.y}px"
	style:width="{L.table.w}px"
	style:height="{L.table.h}px"
	onclick={() => (picked = null)}
>
	<div class="head">
		<div>
			<h1>The Club</h1>
			<div class="dim">Spend your winnings before the next board. Tap a card to read it.</div>
		</div>
		<div class="money">${num(money.current)}</div>
	</div>

	{#key game.shopRolls}
		<div class="wares">
			{#each items as item, i (i)}{@render ware(item, i, true)}{/each}
		</div>
	{/key}

	<div class="owned">
		<h3>Your relics {R.relicSlotsUsed(run)}/{R.relicSlots(run)}</h3>
		<div class="relic-row">
			{#each { length: run.relics.length + Math.max(0, R.relicSlots(run) - R.relicSlotsUsed(run)) }, i (i)}
				{@const relic = run.relics[i]}
				{#if relic}
					<div class="relic" style:border-color={css(C.rarity[relic.def.rarity])} title={relics.textFor((void game.v, relic), run.balance)}>
						<div class="relic-head">
							<Shine edition={relic.edition}><Icon name={relic.def.icon} scale={2} /></Shine>
							<span class="rname">
								{#if relic.edition}<span class="ed" style:color={editionColor(relic.edition)}>{relics.EDITIONS[relic.edition].name.toUpperCase()}</span>{/if}
								<span>{relic.name}</span>
							</span>
						</div>
						<Button variant="plain" size="sm" sound="sell" onclick={() => game.sellRelic(i)} style="width: 100%">Sell ${Math.max(1, Math.floor(relic.cost / 2))}</Button>
					</div>
				{:else}
					<div class="relic empty">empty</div>
				{/if}
			{/each}
		</div>
	</div>

	{#if game.sealPick !== null}<CardPicker />{/if}
	{#if run.opening}<BundleOpen />{/if}

	<div class="foot">
		<Button variant="plain" sound="reroll" enabled={run.money >= run.rerollCost} onclick={() => game.reroll()} style="width: 190px; height: 44px">Reroll ${run.rerollCost}</Button>
		<Button pulse onclick={() => game.leaveShop()} style="width: 210px; height: 44px">{nextLabel}</Button>
	</div>
</div>

<style>
	.shop {
		position: absolute;
		box-sizing: border-box;
		padding: 18px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		z-index: 110;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h1 {
		margin: 0;
		font-size: 44px;
		color: var(--brass);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
	}
	.money {
		font-size: 44px;
		font-weight: 700;
		color: var(--brass);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
		font-variant-numeric: tabular-nums;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
	}
	.wares {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
		height: 270px;
		background: radial-gradient(ellipse at center, var(--felt-light), var(--felt-edge) 80%);
		border: 3px solid var(--brass-dim);
		box-shadow:
			inset 0 0 0 3px rgba(0, 0, 0, 0.25),
			0 6px 0 rgba(0, 0, 0, 0.35);
	}
	.portrait .wares {
		flex-wrap: wrap;
		height: auto;
		padding: 24px 0;
	}

	.item {
		position: relative;
		width: 150px;
		cursor: pointer;
		outline: none;
		transition: transform 0.12s;
		-webkit-tap-highlight-color: transparent;
	}
	.item:hover,
	.item.sel {
		transform: translateY(-8px) rotate(-1.5deg);
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
		justify-content: space-between;
		padding: 10px 10px 12px;
		background: #f3ead6;
		color: #2a2418;
		border: 4px solid var(--edge);
		box-shadow:
			inset 0 0 0 3px #f3ead6,
			inset 0 0 0 5px color-mix(in srgb, var(--edge) 45%, #f3ead6),
			0 7px 0 rgba(0, 0, 0, 0.45);
		--px-a: 6px;
		--px-sy: 7px;
		clip-path: var(--px-clip);
		animation: bobitem 3.9s ease-in-out infinite;
	}
	.sel .card {
		box-shadow:
			inset 0 0 0 3px #f3ead6,
			inset 0 0 0 5px var(--edge),
			0 10px 0 rgba(0, 0, 0, 0.45);
	}
	@keyframes bobitem {
		50% {
			transform: translateY(-3px);
		}
	}
	.kindline {
		align-self: flex-start;
		font-size: 12px;
		letter-spacing: 0.04em;
		color: color-mix(in srgb, var(--edge) 70%, #2a2418);
		padding-left: 4px;
	}
	.coin {
		position: absolute;
		right: 8px;
		top: 8px;
		min-width: 38px;
		height: 38px;
		box-sizing: border-box;
		padding: 0 6px;
		--px-a: 10px;
		--px-b: 4px;
		--px-sy: 0px;
		clip-path: var(--px-clip);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brass);
		box-shadow: inset 0 -3px 0 var(--brass-dim), inset 0 2px 0 rgba(255, 255, 255, 0.35);
		color: #2a2418;
		font-size: 16px;
		font-weight: 700;
	}
	.art {
		flex: 1;
		display: flex;
		align-items: center;
	}
	.ed-card {
		width: 54px;
		height: 76px;
		display: block;
	}
	.name {
		font-size: 16px;
		font-weight: 700;
		line-height: 1.1;
		text-align: center;
	}
	.sold .card {
		filter: grayscale(0.8) brightness(0.5);
		animation: none;
	}
	.stamp {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-14deg);
		font-size: 28px;
		font-weight: 700;
		color: #2a2418;
		border: 3px solid #2a2418;
		padding: 0 8px;
	}
	.info {
		display: none;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: 280px;
		z-index: 20;
		cursor: default;
	}
	.info.below {
		top: 100%;
		padding-top: 12px;
	}
	.info.above {
		bottom: 100%;
		padding-bottom: 12px;
	}
	.item:not(.sold):hover .info,
	.item.sel .info {
		display: block;
	}
	.info-box {
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		padding: 10px 14px 12px;
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
		--px-a: 5px;
		--px-sy: 6px;
		clip-path: var(--px-clip);
	}
	.kind {
		font-size: 13px;
	}
	.pack {
		color: var(--chips);
	}
	.brass {
		color: var(--brass);
	}
	.ink {
		color: var(--ink) !important;
	}
	h3 {
		margin: 4px 0 2px;
		font-size: 20px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	p {
		margin: 5px 0 0;
		font-size: 15px;
		line-height: 1.3;
		color: var(--ink-dim);
	}
	.buy {
		margin-top: 10px;
	}

	.owned h3 {
		margin: 0 0 8px;
	}
	.ed {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		margin-right: 6px;
	}
	.rname {
		display: flex;
		flex-direction: column;
		line-height: 1.05;
	}
	.rname .ed {
		font-size: 11px;
	}
	.relic-row {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
	}
	.portrait .relic-row {
		grid-template-columns: repeat(3, 1fr);
	}
	.relic {
		position: relative;
		height: 110px;
		box-sizing: border-box;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
		--px-sy: 6px;
		clip-path: var(--px-clip);
	}
	.relic-head {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 15px;
		line-height: 1.15;
	}
	.relic.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		border: none;
		box-shadow: none;
		--px-a: 4px;
		--px-sy: 0px;
		color: var(--ink-faint);
		font-size: 14px;
	}
	.foot {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
	}
</style>
