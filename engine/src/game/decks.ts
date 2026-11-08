// Starting decks (ruleset v5): a choice on the menu that changes how a run
// begins. The run records its deck, so a save replays the same start.

export type DeckKey = 'standard' | 'burned' | 'gilded' | 'royal' | 'schemer' | 'collector';

export interface DeckDef {
	key: DeckKey;
	name: string;
	text: string;
}

export const DECKS: Record<DeckKey, DeckDef> = {
	standard: { key: 'standard', name: 'Standard Deck', text: 'The usual start' },
	burned: { key: 'burned', name: 'Burned Deck', text: 'The queen of spades is burned from the pack' },
	gilded: { key: 'gilded', name: 'Gilded Deck', text: 'Start with $8' },
	royal: { key: 'royal', name: 'Royal Deck', text: 'The ace of spades starts Etched' },
	schemer: { key: 'schemer', name: "Schemer's Deck", text: 'Start with two ploys' },
	collector: { key: 'collector', name: "Collector's Deck", text: 'Start with a random common relic, but only $2' }
};
export const DECK_KEYS = Object.keys(DECKS) as DeckKey[];
