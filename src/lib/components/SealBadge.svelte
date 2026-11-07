<!-- A wax seal: a colored disc with the seal's letter. -->
<script lang="ts">
	import { SEALS, type SealKey } from '../game/seals.ts';

	let { seal, size = 20 }: { seal: SealKey; size?: number } = $props();
	const def = $derived(SEALS[seal]);
</script>

<span
	class="seal"
	title={def.name}
	style:--c={def.color}
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{size * 0.58}px">{def.glyph}</span
>

<style>
	.seal {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 30%,
			color-mix(in srgb, var(--c) 60%, white),
			var(--c) 55%,
			color-mix(in srgb, var(--c) 70%, black)
		);
		box-shadow:
			0 0 0 1.5px color-mix(in srgb, var(--c) 60%, black),
			1px 2px 0 rgba(0, 0, 0, 0.35);
		color: #fff8e8;
		font-weight: 800;
		line-height: 1;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
		font-family: Georgia, 'Times New Roman', serif;
	}
</style>
