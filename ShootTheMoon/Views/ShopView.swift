import SwiftUI

/// The club: four items (relics, upgrades, seals, pack items), your relics
/// to sell, a reroll and the way on.
struct ShopView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let L = model.layout
        let next = v.board == 3 && v.table == v.tables ? "Claim victory" : v.board == 3 ? "Next table" : "Next board"
        VStack(alignment: .leading, spacing: 14 + L.dy * 0.15) {
            HStack(alignment: .top) {
                VStack(alignment: .leading) {
                    Text("The Club").font(Theme.font(44, .bold)).foregroundStyle(Theme.brass).inkShadow(4)
                    Text("Spend your winnings before the next board.").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                }
                Spacer()
                Text("$\(num(v.money))").font(Theme.font(44, .bold)).monospacedDigit().foregroundStyle(Theme.brass).inkShadow(4)
                    .contentTransition(.numericText())
                    .padding(.trailing, 100) // clear of the Menu button
                    .padding(.top, 30)
            }
            HStack(spacing: 18) {
                ForEach(v.shop ?? []) { item in ShopItemCard(item: item) }
            }
            .frame(height: 290 + L.dy * 0.5)
            VStack(alignment: .leading, spacing: 8) {
                Text("Your relics \(v.relics.count)/\(v.relicSlots)").font(Theme.font(20, .bold))
                HStack(spacing: 12) {
                    ForEach(0..<v.relicSlots, id: \.self) { i in
                        if i < v.relics.count {
                            let r = v.relics[i]
                            VStack(alignment: .leading) {
                                HStack(spacing: 8) { Icon(key: r.icon); Text(r.name).font(Theme.font(15)).lineLimit(2) }
                                Spacer()
                                GameButton("Sell $\(r.sell)", style: .plain, size: .small, sound: "sell") { model.sellRelic(i) }
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.rarity[r.rarity], lineWidth: 2))
                        } else {
                            Text("empty").font(Theme.font(14)).foregroundStyle(Theme.inkFaint)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.bg))
                        }
                    }
                }
                .frame(height: 110 + L.dy * 0.4)
            }
            Spacer()
            HStack {
                GameButton("Reroll $\(v.rerollCost)", style: .plain, enabled: v.money >= v.rerollCost, sound: "reroll") { model.reroll() }
                    .frame(width: 190)
                Spacer()
                GameButton(next, pulse: true) { model.leaveShop() }.frame(width: 210)
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 30).padding(.top, 18).padding(.bottom, 26)
        .frame(width: L.table.width, height: L.table.height)
        .animation(.spring(duration: 0.35), value: v.money)
    }
}

struct ShopItemCard: View {
    @Environment(GameModel.self) private var model
    let item: ShopItemV

    var edge: Color {
        switch item.kind {
        case "relic": Theme.rarity[item.rarity ?? 1]
        case "seal": Color(css: item.color ?? "#d9a441")
        case "pack": Theme.chips
        default: Theme.brass
        }
    }

    var kindLabel: String {
        switch item.kind {
        case "relic": "\(item.rarityName ?? "") relic"
        case "seal": "Seal"
        case "pack": "Pack"
        default: "Upgrade"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(kindLabel).font(Theme.font(14)).foregroundStyle(edge)
            HStack(alignment: .top) {
                Text(item.name).font(Theme.font(20, .bold)).inkShadow()
                Spacer()
                if let s = item.seal { SealBadge(key: s, size: 42) } else if let i = item.icon { Icon(key: i, scale: 3) }
            }
            Text(item.text + (item.kind == "relic" ? "" : ".")).font(Theme.font(16)).foregroundStyle(Theme.inkDim)
            if item.kind == "upgrade", let lvl = item.level {
                Text("Lv.\(lvl) → Lv.\(lvl + 1): +\(num(item.nextChips ?? 0)) chips, +\(item.nextMult ?? 0, specifier: "%.1f") mult")
                    .font(Theme.font(16))
            }
            if item.kind == "pack" { Text("Changes the pack everyone is dealt from. You choose the card.").font(Theme.font(15)) }
            if item.kind == "seal" { Text("You choose the card.").font(Theme.font(16)) }
            Spacer(minLength: 0)
            if item.sold {
                Text("SOLD").font(Theme.font(28, .bold)).foregroundStyle(Theme.inkDim).frame(maxWidth: .infinity)
            } else {
                GameButton("Buy $\(item.cost)", enabled: item.canBuy, sound: nil) { model.buy(item) }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(edge, lineWidth: 2))
        .overlay { if item.sold { RoundedRectangle(cornerRadius: 10).fill(.black.opacity(0.5)).allowsHitTesting(false) } }
    }
}

/// Choose a card from the run's pack for a seal or a pack item.
struct CardPickerView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let item = v.shop?.first { $0.slot == model.pickerSlot }
        let rows = [4, 3, 2, 1].map { s in v.pack.filter { $0.suit == s } }.filter { !$0.isEmpty }
        let cols = max(13, rows.map(\.count).max() ?? 13)
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea().onTapGesture { model.pickerSlot = nil }
            Panel {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 14) {
                        if let s = item?.seal { SealBadge(key: s, size: 42) } else if let i = item?.icon { Icon(key: i, scale: 2) }
                        VStack(alignment: .leading) {
                            Text("Choose a card: \(item?.name ?? "")").font(Theme.font(24, .bold)).inkShadow()
                            Text((item?.text ?? "") + ".").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        }
                    }
                    VStack(spacing: 8) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 4) {
                                ForEach(row) { c in
                                    let blocked = item?.kind == "pack" && model.engine.canApply(slot: item!.slot, cardId: c.id) != nil
                                    Button { model.pick(c.id) } label: {
                                        PixelImage(image: model.art.card(c, fourColor: model.fourColor))
                                            .aspectRatio(80 / 112, contentMode: .fit)
                                            .overlay(alignment: .topTrailing) {
                                                if let s = c.seal { SealBadge(key: s, size: 21).offset(x: 3, y: -3) }
                                            }
                                            .opacity(blocked ? 0.35 : 1)
                                    }
                                    .buttonStyle(PressStyle())
                                    .frame(width: (900 - Double(cols - 1) * 4) / Double(cols))
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    HStack {
                        Text("Costs $\(item?.cost ?? 0) · pack: \(v.pack.count) cards").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        Spacer()
                        GameButton("Cancel", style: .plain) { model.pickerSlot = nil }.frame(width: 140)
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 950)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }
}
