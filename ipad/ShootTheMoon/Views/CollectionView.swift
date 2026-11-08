import SwiftUI

/// Everything in the game: every relic, boss, seal, pack item, edition and
/// upgrade, from the main menu.
struct CollectionView: View {
    @Environment(GameModel.self) private var model
    @State private var tab = Tab.stats

    enum Tab: String, CaseIterable {
        case stats = "Stats", relics = "Relics", bosses = "Bosses", sealsPack = "Seals & Pack", editions = "Editions & Upgrades"
    }

    var body: some View {
        let L = model.layout
        ZStack {
            Color.black.opacity(0.6).onTapGesture { model.showCollection = false }
            Panel {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Collection").font(Theme.font(34, .bold)).foregroundStyle(Theme.brass).inkShadow(3)
                        Spacer()
                        GameButton("Close", style: .plain, size: .small) { model.showCollection = false }.frame(width: 110)
                    }
                    HStack(spacing: 8) {
                        ForEach(Tab.allCases, id: \.self) { t in
                            GameButton(t.rawValue, style: tab == t ? .brass : .plain, size: .small, sound: "select") { tab = t }
                        }
                    }
                    ScrollView {
                        content.padding(.bottom, 8)
                    }
                    .scrollIndicators(.hidden)
                }
                .padding(.horizontal, 26).padding(.vertical, 20)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: L.W - 120, height: L.H - 80)
        }
    }

    @ViewBuilder
    private var content: some View {
        if let c = model.catalog {
            let p = model.profile
            let found = Set(p.relicsFound), beaten = Set(p.bossesBeaten)
            switch tab {
            case .stats:
                stats(p, relics: c.relics.count, bosses: c.bosses.count, icons: Dictionary(c.relics.map { ($0.key, $0.icon) }, uniquingKeysWith: { a, _ in a }))
            case .relics:
                VStack(alignment: .leading, spacing: 16) {
                    Text("\(c.relics.count) relics, \(found.count) found. The club offers ones you don't own; rarer ones turn up less often.")
                        .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    ForEach(1...4, id: \.self) { rarity in
                        let list = c.relics.filter { $0.rarity == rarity }
                        if let first = list.first {
                            Text("\(first.rarityName) · \(list.count)").font(Theme.font(20, .bold)).foregroundStyle(Theme.rarity[rarity])
                            grid(list) { r in
                                Tile(edge: Theme.rarity[r.rarity]) {
                                    HStack(alignment: .top, spacing: 10) {
                                        Icon(key: r.icon, scale: 2)
                                        VStack(alignment: .leading, spacing: 3) {
                                            HStack {
                                                Text(r.name).font(Theme.font(17, .bold))
                                                if found.contains(r.key) { Text("FOUND").font(Theme.font(11)).kerning(1).foregroundStyle(Theme.good) }
                                                Spacer()
                                                Text("$\(r.cost)").font(Theme.font(14)).foregroundStyle(Theme.brass)
                                            }
                                            Text(r.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                    }
                                }
                                .opacity(found.contains(r.key) ? 1 : 0.6)
                            }
                        }
                    }
                }
            case .bosses:
                VStack(alignment: .leading, spacing: 12) {
                    Text("Each table's High Board has one boss, chosen when the table starts. Harsher bosses join from table 3 and table 6. \(beaten.count) of \(c.bosses.count) beaten.")
                        .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    grid(c.bosses) { b in
                        Tile(edge: Theme.bad) {
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(b.name).font(Theme.font(17, .bold))
                                    if beaten.contains(b.key) { Text("BEATEN").font(Theme.font(11)).kerning(1).foregroundStyle(Theme.good) }
                                    Spacer()
                                    Text("From table \(b.tier == 1 ? 1 : b.tier == 2 ? 3 : 6)").font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                                }
                                Text(b.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .opacity(beaten.contains(b.key) ? 1 : 0.6)
                    }
                }
            case .sealsPack:
                VStack(alignment: .leading, spacing: 12) {
                    Text("Seals").font(Theme.font(20, .bold)).foregroundStyle(Theme.ploy)
                    Text("A seal marks one card in your pack for the rest of the run.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    grid(c.seals) { s in
                        Tile(edge: Color(css: s.color)) {
                            HStack(alignment: .top, spacing: 10) {
                                SealBadge(key: s.key, size: 36)
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack { Text(s.name).font(Theme.font(17, .bold)); Spacer(); Text("$\(s.cost)").font(Theme.font(14)).foregroundStyle(Theme.brass) }
                                    Text(s.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    Text("Pack items").font(Theme.font(20, .bold)).foregroundStyle(Theme.chips).padding(.top, 8)
                    Text("Pack items change the cards everyone is dealt from.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    grid(c.packItems) { p in
                        Tile(edge: Theme.chips) {
                            HStack(alignment: .top, spacing: 10) {
                                Icon(key: p.icon, scale: 2)
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack { Text(p.name).font(Theme.font(17, .bold)); Spacer(); Text("$\(p.cost)").font(Theme.font(14)).foregroundStyle(Theme.brass) }
                                    Text(p.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                }
            case .editions:
                VStack(alignment: .leading, spacing: 12) {
                    Text("Editions").font(Theme.font(20, .bold)).foregroundStyle(Theme.brass)
                    Text("A relic in the club sometimes comes with an edition, a bonus on top of what it does.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    grid(c.editions) { e in
                        Tile(edge: Edition.color(e.key)) {
                            HStack(alignment: .top, spacing: 10) {
                                Icon(key: "honour_roll", scale: 2).modifier(EditionShine(edition: e.key))
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack { Text(e.name).font(Theme.font(17, .bold)).foregroundStyle(Edition.color(e.key)); Spacer(); Text("+$\(e.cost)").font(Theme.font(14)).foregroundStyle(Theme.brass) }
                                    Text(e.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    if let ce = c.cardEditions, !ce.isEmpty {
                        Text("Card editions").font(Theme.font(20, .bold)).foregroundStyle(Theme.brass).padding(.top, 8)
                        Text("The same three looks on a card in your pack, for the rest of the run. They pay in the hands where you play that card.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        grid(ce) { e in
                            Tile(edge: Edition.color(e.key)) {
                                HStack(alignment: .top, spacing: 10) {
                                    PixelImage(image: model.art.card(.sample, fourColor: model.fourColor)).frame(width: 40, height: 56)
                                        .modifier(EditionShine(edition: e.key))
                                    VStack(alignment: .leading, spacing: 3) {
                                        HStack { Text("\(e.name) card").font(Theme.font(17, .bold)).foregroundStyle(Edition.color(e.key)); Spacer(); Text("$\(e.cost)").font(Theme.font(14)).foregroundStyle(Theme.brass) }
                                        Text(e.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            }
                        }
                    }
                    Text("Upgrades").font(Theme.font(20, .bold)).foregroundStyle(Theme.brass).padding(.top, 8)
                    grid(c.upgrades) { u in
                        Tile(edge: Theme.brass) {
                            HStack(alignment: .top, spacing: 10) {
                                Icon(key: u.icon, scale: 2)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(u.name).font(Theme.font(17, .bold))
                                    Text(u.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                    Text("+\(num(u.chips)) chips, +\(u.mult, specifier: "%.1f") mult per level").font(Theme.font(13)).foregroundStyle(Theme.brass)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            Text("The collection couldn't be loaded.").font(Theme.font(16)).foregroundStyle(Theme.inkDim)
        }
    }

    private func stats(_ p: ProfileV, relics: Int, bosses: Int, icons: [String: String]) -> some View {
        let totals: [(String, String)] = [
            ("Runs", num(p.runs)),
            ("Won", "\(num(p.wins))\(p.runs > 0 ? " (\(Int((100 * Double(p.wins) / Double(p.runs)).rounded()))%)" : "")"),
            ("Furthest table", p.bestTable > 0 ? "\(p.bestTable) of 8" : "-"),
            ("Best hand", num(p.bestHand)),
            ("Moons shot", num(p.moons)),
            ("Clean hands", num(p.cleanHands)),
            ("Hands played", num(p.handsPlayed)),
            ("Relics found", "\(p.relicsFound.count) of \(relics)"),
            ("Bosses beaten", "\(p.bossesBeaten.count) of \(bosses)"),
        ]
        let result = ["won": "Won", "lost": "Lost", "abandoned": "Left", "playing": "In play"]
        let df = DateFormatter()
        df.setLocalizedDateFormatFromTemplate("MMMd")
        return VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                ForEach(totals, id: \.0) { t in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.0).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                        Text(t.1).font(Theme.font(26, .bold)).foregroundStyle(Theme.brass).inkShadow()
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(PixelRect(radius: 4).fill(Theme.panel))
                    .overlay(PixelRect(radius: 4).stroke(Theme.panelEdge, lineWidth: 2))
                }
            }
            Text("Recent runs").font(Theme.font(20, .bold)).foregroundStyle(Theme.brass).padding(.top, 6)
            if p.history.isEmpty {
                Text("No runs yet.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
            }
            ForEach(p.history) { r in
                HStack(spacing: 10) {
                    Text(df.string(from: Date(timeIntervalSince1970: r.started / 1000))).foregroundStyle(Theme.inkDim).frame(width: 70, alignment: .leading)
                    Text(result[r.result] ?? r.result).foregroundStyle(r.result == "won" ? Theme.good : r.result == "lost" ? Theme.bad : Theme.ink).frame(width: 70, alignment: .leading)
                    Text(r.result == "won" ? "All 8 tables" : "Table \(r.table), \(r.board == 3 ? "High Board" : "Board \(r.board)")").frame(width: 190, alignment: .leading)
                    Text(num(r.bestHand)).frame(width: 90, alignment: .leading)
                    Text("\(r.moons) moon\(r.moons == 1 ? "" : "s")").frame(width: 80, alignment: .leading)
                    HStack(spacing: 2) { ForEach(r.relics.prefix(6), id: \.self) { k in if let i = icons[k] { Icon(key: i, scale: 1) } } }
                    Spacer()
                    Text(r.seed).foregroundStyle(Theme.inkDim)
                }
                .font(Theme.font(15))
                .padding(.vertical, 4)
                Divider().overlay(Theme.panelEdge)
            }
        }
    }

    private func grid<T: Identifiable, V: View>(_ items: [T], @ViewBuilder _ tile: @escaping (T) -> V) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: 3), alignment: .leading, spacing: 12) {
            ForEach(items) { tile($0) }
        }
    }
}

private struct Tile<Content: View>: View {
    let edge: Color
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
            .background(PixelRect(radius: 8).fill(Theme.panel))
            .overlay(PixelRect(radius: 8).stroke(edge.opacity(0.8), lineWidth: 2))
    }
}
