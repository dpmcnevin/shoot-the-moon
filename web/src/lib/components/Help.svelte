<!-- How to play. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { game } from '../app/game.svelte.ts';
	import Button from './Button.svelte';

	const HELP = [
		'Hearts, against three opponents. Every heart you take costs a point, and the queen of spades costs thirteen. Take every point, though, and you shoot the moon.',
		"Each hand starts with a pass: pick three cards to give away (left, right, across, then a hand with no passing). The lowest club leads, and you must follow suit if you can. Hearts can only be led once they're broken: by a heart being played, or by someone taking the queen.",
		'Each hand scores chips x mult. Your chips are 26 less the points you took, plus a bonus for a clean hand. Shooting the moon pays three times the points in the pack.',
		"Reach each board's goal within three hands. Win boards to earn money, then spend it at the club on relics, upgrades, seals and editions that mark a card for the rest of the run, and pack items that change the cards everyone is dealt.",
		'Some relics pay you to take hearts or the queen, so a run can go hunting instead of hiding. Beat all three boards at each of eight tables to win.',
		"Each table's High Board has a boss: a house rule that bends Hearts for that board, from a doubled queen to opponents who gang up on you. You see the boss when the table starts; click the table progress in the sidebar to look again."
	];
	const L = $derived(game.layout);
	const pw = $derived(Math.min(760, L.W - 40));
</script>

<div class="backdrop" role="presentation" onclick={() => (game.showHelp = false)} transition:fade={{ duration: 120 }}></div>
<div
	class="panel help"
	style:left="{(L.W - pw) / 2}px"
	style:top="{L.orientation === 'portrait' ? 260 : 80}px"
	style:width="{pw}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>How to play</h2>
	{#each HELP as para (para)}<p>{para}</p>{/each}
	<p class="keys">Space or Enter: the next step. Esc: back to the menu. M: music. Drag cards to rearrange your hand, or onto the table to play them.</p>
	<div class="foot"><Button onclick={() => (game.showHelp = false)} style="width: 150px">Got it</Button></div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.help {
		box-sizing: border-box;
		padding: 20px 30px;
		z-index: 310;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 28px;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	p {
		font-size: 17px;
		line-height: 1.35;
		margin: 0 0 12px;
	}
	.keys {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
	}
</style>
