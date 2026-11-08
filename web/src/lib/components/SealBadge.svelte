<!-- A wax seal, drawn as pixel art and scaled with hard pixels. -->
<script lang="ts">
	import { SEALS, type SealKey } from '$engine/game/seals.ts';
	import { seal as sealImage } from '../ui/images.ts';

	let { seal, size = 20 }: { seal: SealKey; size?: number } = $props();
	const def = $derived(SEALS[seal]);
</script>

<img class="seal" src={sealImage(seal)} width={size} height={size} alt={def.name} title={def.name} draggable="false" />

<style>
	.seal {
		display: inline-block;
		flex: none;
		image-rendering: pixelated;
		filter: drop-shadow(1px 2px 0 rgba(0, 0, 0, 0.35));
	}
</style>
