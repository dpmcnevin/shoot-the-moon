import SwiftUI

/// An opened bundle: three choices side by side; take one, or none.
struct BundleView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        if let v = model.view, let open = v.opening { panel(v, open) }
    }

    private func panel(_ v: GameView, _ open: OpeningV) -> some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            Panel(edge: Theme.ploy) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(open.name).font(Theme.font(26, .bold)).inkShadow()
                        Text("Choose one.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    }
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(Array(open.options.enumerated()), id: \.offset) { i, c in choice(i, c) }
                    }
                    HStack {
                        Text(open.bundle == "relic" ? "Relics \(v.relicSlotsUsed)/\(v.relicSlots)" : open.bundle == "ploy" ? "Ploys \(v.ploys?.count ?? 0)/2" : "The edition stays on the card for the run.")
                            .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        Spacer()
                        GameButton("Take none", style: .plain) { model.pickBundle(-1) }.frame(width: 160)
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 860)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }

    private func choice(_ i: Int, _ c: OpeningV.Choice) -> some View {
        let edge: Color = c.kind == "relic" ? Theme.rarity[c.rarity ?? 1] : c.kind == "ploy" ? Theme.ploy : Edition.color(c.cardEdition ?? "etched")
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if let e = c.edition { EditionTag(edition: e, size: 12) }
                Text(c.kind == "relic" ? "\(c.rarityName ?? "") relic" : c.kind == "ploy" ? "Ploy" : "Card edition").font(Theme.font(14)).foregroundStyle(edge)
            }
            HStack {
                Spacer()
                if let card = c.card {
                    PixelImage(image: model.art.card(card, fourColor: model.fourColor)).frame(width: 80, height: 112)
                        .modifier(EditionShine(edition: c.cardEdition))
                } else if let icon = c.icon {
                    Icon(key: icon, scale: 4).modifier(EditionShine(edition: c.edition?.key))
                }
                Spacer()
            }
            .frame(height: 120)
            Text(c.name).font(Theme.font(20, .bold))
            Text(c.text + (c.kind == "relic" ? "" : ".")).font(Theme.font(15)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            GameButton("Take", sound: nil) { model.pickBundle(i) }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)
        .background(PixelRect(radius: 8).fill(Theme.bg))
        .overlay(PixelRect(radius: 8).stroke(edge, lineWidth: 2))
    }
}
