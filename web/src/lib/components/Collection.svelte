<!-- Everything in the game, from the main menu: every relic (by rarity),
     every boss, seals and pack items, editions and upgrades, as the rules new
     runs use describe them. -->
<script lang="ts">
	import * as R from '$engine/game/run.ts';
	import * as relics from '$engine/game/relics.ts';
	import * as bosses from '$engine/game/bosses.ts';
	import * as seals from '$engine/game/seals.ts';
	import * as packs from '$engine/game/pack.ts';
	import { C, css } from '$engine/ui/theme.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import SealBadge from './SealBadge.svelte';
	import Shine from './Shine.svelte';
	import { editionColor } from './editions.ts';

	type Tab = 'relics' | 'bosses' | 'seals' | 'editions';
	const TABS: [Tab, string][] = [
		['relics', 'Relics'],
		['bosses', 'Bosses'],
		['seals', 'Seals & Pack'],
		['editions', 'Editions & Upgrades']
	];
	let tab = $state<Tab>('relics');

	/** The balance new runs use (the web's ruleset). */
	const balance = R.resolveOptions({ ruleset: 'v3' }).balance ?? 1;
	const L = $derived(game.layout);
	const pool = relics.DEFS;
	const bossList = bosses.BOSS_KEYS.map((k) => bosses.bossAt(k, balance));
	const packItems = [...Object.values(packs.OPS), { ...packs.recolorDef(1), name: 'Recolor', text: 'Turn a card into another suit (the suit is on the item), same rank' }];
	const from = (tier: number) => (tier === 1 ? 1 : tier === 2 ? 3 : 6);
</script>

<button class="scrim" aria-label="Close" onclick={() => (game.showCollection = false)}></button>
<div class="panel coll" style:left="60px" style:top="40px" style:width="{L.W - 120}px" style:height="{L.H - 80}px" role="dialog" aria-label="Collection">
	<div class="head">
		<h2>Collection</h2>
		<Button variant="plain" size="sm" onclick={() => (game.showCollection = false)} style="width: 110px">Close</Button>
	</div>
	<div class="tabs" role="tablist">
		{#each TABS as [key, label] (key)}
			<Button variant={tab === key ? 'brass' : 'plain'} size="sm" sound="select" onclick={() => (tab = key)} style="flex: 1">{label}</Button>
		{/each}
	</div>
	<div class="body">
		{#if tab === 'relics'}
			<p class="lead">{pool.length} relics. The club offers ones you don't own; rarer ones turn up less often.</p>
			{#each [1, 2, 3, 4] as rarity (rarity)}
				{@const list = pool.filter((d) => d.rarity === rarity)}
				<h3 style:color={css(C.rarity[rarity])}>{relics.RARITY_NAME[rarity]} · {list.length}</h3>
				<div class="grid">
					{#each list as d (d.key)}
						<div class="tile" style:border-color={css(C.rarity[rarity])}>
							<Icon name={d.icon} scale={2} />
							<div class="tbody">
								<div class="trow"><span class="tname">{d.name}</span><span class="brass">${relics.costAt(d, balance)}</span></div>
								<div class="ttext">{relics.textAt(d, balance)}</div>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		{:else if tab === 'bosses'}
			<p class="lead">Each table's High Board has one boss, chosen when the table starts. Harsher bosses join from table 3 and table 6.</p>
			<div class="grid">
				{#each bossList as b (b.key)}
					<div class="tile" style:border-color="var(--bad)">
						<div class="tbody">
							<div class="trow"><span class="tname">{b.name}</span><span class="dim">From table {from(b.tier)}</span></div>
							<div class="ttext">{b.text}</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if tab === 'seals'}
			<h3 style:color="var(--ploy)">Seals</h3>
			<p class="lead">A seal marks one card in your pack for the rest of the run.</p>
			<div class="grid">
				{#each seals.SEAL_KEYS as k (k)}
					{@const sd = seals.SEALS[k]}
					<div class="tile" style:border-color={sd.color}>
						<SealBadge seal={k} size={36} />
						<div class="tbody">
							<div class="trow"><span class="tname">{sd.name}</span><span class="brass">${sd.cost}</span></div>
							<div class="ttext">{sd.text}</div>
						</div>
					</div>
				{/each}
			</div>
			<h3 style:color="var(--chips)">Pack items</h3>
			<p class="lead">Pack items change the cards everyone is dealt from.</p>
			<div class="grid">
				{#each packItems as o (o.key)}
					<div class="tile" style:border-color="var(--chips)">
						<Icon name={o.icon} scale={2} />
						<div class="tbody">
							<div class="trow"><span class="tname">{o.name}</span><span class="brass">${o.cost}</span></div>
							<div class="ttext">{o.text}</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<h3 style:color="var(--brass)">Editions</h3>
			<p class="lead">A relic in the club sometimes comes with an edition, a bonus on top of what it does.</p>
			<div class="grid">
				{#each relics.EDITION_KEYS as k (k)}
					{@const e = relics.EDITIONS[k]}
					<div class="tile" style:border-color={editionColor(k)}>
						<Shine edition={k}><Icon name="honour_roll" scale={2} /></Shine>
						<div class="tbody">
							<div class="trow"><span class="tname" style:color={editionColor(k)}>{e.name}</span><span class="brass">+${e.cost}</span></div>
							<div class="ttext">{e.text}</div>
						</div>
					</div>
				{/each}
			</div>
			<h3 style:color="var(--brass)">Upgrades</h3>
			<div class="grid">
				{#each Object.values(R.UPGRADES) as u (u.key)}
					<div class="tile" style:border-color="var(--brass)">
						<Icon name={u.icon} scale={2} />
						<div class="tbody">
							<div class="tname">{u.name}</div>
							<div class="ttext">{u.text}</div>
							<div class="brass small">+{num(u.chips)} chips, +{u.mult.toFixed(1)} mult per level</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 299;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		padding: 0;
	}
	.coll {
		z-index: 300;
		padding: 20px 26px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 34px;
		color: var(--brass);
		text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
	}
	h3 {
		margin: 14px 0 8px;
		font-size: 20px;
	}
	.tabs {
		display: flex;
		gap: 8px;
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding-right: 4px;
	}
	.lead {
		margin: 0 0 8px;
		font-size: 15px;
		color: var(--ink-dim);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.tile {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px;
		min-height: 68px;
		background: var(--panel);
		border: 2px solid;
	}
	.tbody {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}
	.trow {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.tname {
		font-size: 17px;
		font-weight: 700;
	}
	.ttext {
		font-size: 14px;
		color: var(--ink-dim);
	}
	.brass {
		color: var(--brass);
		font-size: 14px;
	}
	.small {
		font-size: 13px;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 13px;
	}
</style>
