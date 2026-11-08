<!-- Everything in the game, from the main menu: every relic (by rarity),
     every boss, seals and pack items, editions and upgrades, as the rules new
     runs use describe them. -->
<script lang="ts">
	import * as R from '$engine/game/run.ts';
	import * as relics from '$engine/game/relics.ts';
	import * as bosses from '$engine/game/bosses.ts';
	import * as seals from '$engine/game/seals.ts';
	import * as cardEds from '$engine/game/cardEditions.ts';
	import * as cards from '$engine/rules/cards.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { WEB_RULESET } from '../app/game.svelte.ts';
	import * as packs from '$engine/game/pack.ts';
	import { C, css } from '$engine/ui/theme.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import SealBadge from './SealBadge.svelte';
	import Shine from './Shine.svelte';
	import { editionColor } from './editions.ts';

	type Tab = 'stats' | 'relics' | 'bosses' | 'seals' | 'editions';
	const TABS: [Tab, string][] = [
		['stats', 'Stats'],
		['relics', 'Relics'],
		['bosses', 'Bosses'],
		['seals', 'Seals & Pack'],
		['editions', 'Editions & Upgrades']
	];
	let tab = $state<Tab>('stats');

	/** The balance new runs use (the web's ruleset). */
	const balance = R.resolveOptions({ ruleset: WEB_RULESET }).balance ?? 1;
	const L = $derived(game.layout);
	const pool = relics.DEFS;
	const bossList = bosses.BOSS_KEYS.map((k) => bosses.bossAt(k, balance));
	const packItems = [...Object.values(packs.OPS), { ...packs.recolorDef(1), name: 'Recolor', text: 'Turn a card into another suit (the suit is on the item), same rank' }];
	const from = (tier: number) => (tier === 1 ? 1 : tier === 2 ? 3 : 6);

	const prof = $derived(game.profile);
	const found = $derived(new Set(prof.relicsFound));
	const beaten = $derived(new Set(prof.bossesBeaten));
	const totals = $derived([
		['Runs', num(prof.runs)],
		['Won', `${num(prof.wins)}${prof.runs ? ` (${Math.round((100 * prof.wins) / prof.runs)}%)` : ''}`],
		['Furthest table', prof.bestTable ? `${prof.bestTable} of ${R.TABLES}` : '-'],
		['Best hand', num(prof.bestHand)],
		['Moons shot', num(prof.moons)],
		['Clean hands', num(prof.cleanHands)],
		['Hands played', num(prof.handsPlayed)],
		['Relics found', `${prof.relicsFound.length} of ${pool.length}`],
		['Bosses beaten', `${prof.bossesBeaten.length} of ${bossList.length}`]
	]);
	const RESULT: Record<string, string> = { won: 'Won', lost: 'Lost', abandoned: 'Left', playing: 'In play' };
	const when = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
		{#if tab === 'stats'}
			<div class="totals">
				{#each totals as [label, value] (label)}
					<div class="stat"><div class="slabel">{label}</div><div class="svalue">{value}</div></div>
				{/each}
			</div>
			<h3 style:color="var(--brass)">Recent runs</h3>
			{#if prof.history.length === 0}
				<p class="lead">No runs yet.</p>
			{:else}
				<div class="runs">
					<div class="run rhead"><span>When</span><span>Result</span><span>Reached</span><span>Best hand</span><span>Moons</span><span>Relics</span><span>Seed</span></div>
					{#each prof.history as r (r.id)}
						<div class="run">
							<span class="dim">{when(r.started)}</span>
							<span class:goodc={r.result === 'won'} class:badc={r.result === 'lost'}>{RESULT[r.result]}</span>
							<span>{r.result === 'won' ? 'All 8 tables' : `Table ${r.table}, ${r.board === R.BOARDS_PER_TABLE ? 'High Board' : `Board ${r.board}`}`}</span>
							<span>{num(r.bestHand)}</span>
							<span>{r.moons}</span>
							<span class="icons">{#each r.relics.slice(0, 6) as k (k)}{@const d = relics.get(k)}{#if d}<Icon name={d.icon} scale={1} />{/if}{/each}</span>
							<span class="dim">{r.seed}</span>
						</div>
					{/each}
				</div>
			{/if}
		{:else if tab === 'relics'}
			<p class="lead">{pool.length} relics, {found.size} found. The club offers ones you don't own; rarer ones turn up less often.</p>
			{#each [1, 2, 3, 4] as rarity (rarity)}
				{@const list = pool.filter((d) => d.rarity === rarity)}
				<h3 style:color={css(C.rarity[rarity])}>{relics.RARITY_NAME[rarity]} · {list.length}</h3>
				<div class="grid">
					{#each list as d (d.key)}
						<div class="tile" class:unseen={!found.has(d.key)} style:border-color={css(C.rarity[rarity])}>
							<Icon name={d.icon} scale={2} />
							<div class="tbody">
								<div class="trow"><span class="tname">{d.name}{#if found.has(d.key)}<span class="mark">FOUND</span>{/if}</span><span class="brass">${relics.costAt(d, balance)}</span></div>
								<div class="ttext">{relics.textAt(d, balance)}</div>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		{:else if tab === 'bosses'}
			<p class="lead">Each table's High Board has one boss, chosen when the table starts. Harsher bosses join from table 3 and table 6. {beaten.size} of {bossList.length} beaten.</p>
			<div class="grid">
				{#each bossList as b (b.key)}
					<div class="tile" class:unseen={!beaten.has(b.key)} style:border-color="var(--bad)">
						<div class="tbody">
							<div class="trow"><span class="tname">{b.name}{#if beaten.has(b.key)}<span class="mark">BEATEN</span>{/if}</span><span class="dim">From table {from(b.tier)}</span></div>
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
			<h3 style:color="var(--brass)">Card editions</h3>
			<p class="lead">The same three looks on a card in your pack, for the rest of the run. They pay in the hands where you play that card.</p>
			<div class="grid">
				{#each cardEds.CARD_EDITION_KEYS as k (k)}
					{@const e = cardEds.CARD_EDITIONS[k]}
					<div class="tile" style:border-color={editionColor(k)}>
						<Shine edition={k}><img class="ed-card" src={cardFace(cards.card(3, 13), false, settings.pixelCards, settings.fourColor)} alt="" /></Shine>
						<div class="tbody">
							<div class="trow"><span class="tname" style:color={editionColor(k)}>{e.name} card</span><span class="brass">${e.cost}</span></div>
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
							<div class="ttext">{R.upgradeText(u.key, balance)}</div>
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
	.ed-card {
		width: 40px;
		height: 56px;
		display: block;
	}
	.unseen {
		opacity: 0.6;
	}
	.mark {
		margin-left: 8px;
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--good);
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.stat {
		padding: 10px 14px;
		background: var(--panel);
		border: 2px solid var(--panel-edge);
		clip-path: var(--px-clip);
	}
	.slabel {
		font-size: 14px;
		color: var(--ink-dim);
	}
	.svalue {
		font-size: 26px;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.runs {
		display: flex;
		flex-direction: column;
		font-size: 15px;
	}
	.run {
		display: grid;
		grid-template-columns: 70px 70px 1.4fr 90px 60px 1.2fr 110px;
		gap: 10px;
		align-items: center;
		padding: 4px 0;
		border-bottom: 2px solid var(--panel-edge);
	}
	.rhead {
		color: var(--ink-dim);
		font-size: 13px;
	}
	.icons {
		display: flex;
		gap: 2px;
	}
	.goodc {
		color: var(--good);
	}
	.badc {
		color: var(--bad);
	}
	.tile {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px;
		min-height: 68px;
		background: var(--panel);
		border: 2px solid;
		clip-path: var(--px-clip);
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
