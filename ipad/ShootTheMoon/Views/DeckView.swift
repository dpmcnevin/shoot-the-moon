import SwiftUI

/// The deck: every card in the run's pack, by suit, with its seal and
/// edition. Your own hand is greyed, so the rest is what the others hold
/// between them. Open until the first trick of a hand is done (the Glass
/// Deck keeps it open all hand, crossing off the cards already played).
struct DeckView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        if let v = model.view { panel(v) }
    }

    private func panel(_ v: GameView) -> some View {
        let rows = [4, 3, 2, 1].map { s in v.pack.filter { $0.suit == s } }.filter { !$0.isEmpty }
        let cols = max(13, rows.map(\.count).max() ?? 13)
        let inHand = v.phase == .pass || v.phase == .play
        let mine = Set(inHand ? v.hand.mine.map(\.id) : [])
        let played = Set(v.phase == .play ? (v.hand.played ?? []) : [])
        let note = !inHand ? "Every hand is dealt from these cards."
            : played.isEmpty ? "Greyed: your hand. The rest are in the other hands."
            : "Greyed: your hand. Crossed off: played. The rest are in the other hands."
        return ZStack {
            Color.black.opacity(0.55).ignoresSafeArea().onTapGesture { model.showDeck = false }
            Panel {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("The deck").font(Theme.font(24, .bold)).foregroundStyle(Theme.brass).inkShadow()
                            Text("\(v.pack.count) cards · \(v.packPoints) points. \(note)").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        }
                        Spacer()
                        GameButton("Close", style: .plain, size: .small) { model.showDeck = false }.frame(width: 110)
                    }
                    VStack(spacing: 8) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 4) {
                                ForEach(row) { c in
                                    PixelImage(image: model.art.card(c, fourColor: model.fourColor))
                                        .aspectRatio(80 / 112, contentMode: .fit)
                                        .modifier(EditionShine(edition: c.edition))
                                        .overlay(alignment: .topTrailing) {
                                            if let s = c.seal { SealBadge(key: s, size: 21).offset(x: 3, y: -3) }
                                        }
                                        .overlay {
                                            if played.contains(c.id) { Color.clear.modifier(Cross()) }
                                        }
                                        .saturation(mine.contains(c.id) ? 0 : 1)
                                        .opacity(mine.contains(c.id) ? 0.35 : played.contains(c.id) ? 0.3 : 1)
                                        .frame(width: (900 - Double(cols - 1) * 4) / Double(cols))
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 950)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
        // Close it once it may no longer be seen (the first trick is done).
        .onChange(of: v.canSeeDeck) { _, can in if can == false { model.showDeck = false } }
    }
}

/// A red line corner to corner, for a card already played.
private struct Cross: ViewModifier {
    func body(content: Content) -> some View {
        GeometryReader { g in
            Path { p in
                p.move(to: CGPoint(x: 0, y: g.size.height))
                p.addLine(to: CGPoint(x: g.size.width, y: 0))
            }
            .stroke(Theme.bad, lineWidth: 4)
        }
    }
}
