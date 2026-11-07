import SwiftUI

/// The run's status: table and board, target and score, this hand's pass and
/// points, the pack, money, upgrade levels, seals and relics.
struct Sidebar: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let pending = v.phase == .handScored && (model.trickHold != nil || !model.revealDone) ? (v.result?.total ?? 0) : 0
        let shown = v.score - pending
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("SHOOT THE MOON").font(Theme.font(19, .bold)).kerning(1).foregroundStyle(Theme.brass).inkShadow()
                HStack {
                    Text("Table \(min(v.table, v.tables)) of \(v.tables)").font(Theme.font(16))
                    Spacer()
                    Text(v.boardName).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    stat("Target", num(v.target))
                    Spacer()
                    stat("Scored", num(shown), color: v.score >= v.target ? Theme.good : Theme.ink, trailing: true)
                }
                ProgressBar(fraction: Double(shown) / Double(max(1, v.target)), color: v.score >= v.target ? Theme.good : Theme.brass)
                HStack(spacing: 6) {
                    Text("Hands").font(Theme.font(12)).foregroundStyle(Theme.inkDim)
                    ForEach(0..<v.handsPerBoard, id: \.self) { i in
                        Circle().fill(i + 1 > v.handsLeft ? Theme.panelEdge : Theme.brass).frame(width: 12, height: 12)
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panel))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.brassDim, lineWidth: 2))
            .padding(.horizontal, -6)
            .animation(.easeOut(duration: 0.6), value: shown)

            VStack(alignment: .leading, spacing: 4) {
                let pass = v.hand.passDir == "hold" ? "No passing" : "Pass \(v.hand.passDir) to \(v.hand.passTo ?? "")"
                Text("This hand · \(Text(pass).foregroundStyle(Theme.ink))").foregroundStyle(Theme.inkDim).font(Theme.font(14))
                Text("Pack \(v.pack.count) · \(v.packPoints) points\(v.hand.kitty.isEmpty ? "" : " · kitty \(v.hand.kitty.count)")")
                    .font(Theme.font(12)).foregroundStyle(Theme.inkFaint)
                HStack(spacing: 4) {
                    ForEach([Seat.player, Seat.west, Seat.north, Seat.east], id: \.self) { s in
                        VStack(spacing: 0) {
                            Text(s == Seat.player ? "You" : v.seatName(s)).font(Theme.font(12)).foregroundStyle(Theme.inkDim)
                            Text("\(v.hand.points[s])").font(Theme.font(20, .bold))
                                .foregroundStyle(v.hand.points[s] > 0 ? Theme.bad : Theme.inkFaint)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Theme.panel))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(s == Seat.player ? Theme.brassDim : .clear, lineWidth: 1))
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    stat("Money", "$\(num(v.money))", color: Theme.brass)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Interest").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                        Text("+$\(v.interest)").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                    }
                }
                ForEach(v.levels) { l in
                    HStack(spacing: 6) {
                        Icon(key: l.icon, scale: 1)
                        Text("\(l.name.replacingOccurrences(of: "The ", with: "")) \(l.level)")
                            .foregroundStyle(l.level > 1 ? Theme.brass : Theme.inkFaint)
                    }
                    .font(Theme.font(14))
                }
            }

            if !v.seals.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Seals").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                    FlowRow(spacing: 8) {
                        ForEach(v.seals) { s in
                            HStack(spacing: 3) {
                                SealBadge(key: s.key, size: 14)
                                Text(s.card?.name ?? "?").font(Theme.font(14, .bold))
                                    .foregroundStyle((s.card?.suit == 2 || s.card?.suit == 3) ? Theme.bad : Theme.ink)
                            }
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Relics \(v.relicSlotsUsed)/\(v.relicSlots)").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                ForEach(0..<(v.relics.count + max(0, v.relicSlots - v.relicSlotsUsed)), id: \.self) { i in
                    if i < v.relics.count {
                        let r = v.relics[i]
                        HStack(spacing: 6) {
                            Icon(key: r.icon).modifier(EditionShine(edition: r.edition?.key))
                            RoundedRectangle(cornerRadius: 1).fill(Theme.rarity[r.rarity]).frame(width: 3, height: 24)
                            VStack(alignment: .leading, spacing: -1) {
                                if let e = r.edition { EditionTag(edition: e, size: 10) }
                                Text(r.name).font(Theme.font(14)).lineLimit(1)
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(height: 36)
                        .background(RoundedRectangle(cornerRadius: 5).fill(Theme.panel))
                        .padding(.horizontal, -4)
                    } else {
                        RoundedRectangle(cornerRadius: 5).fill(Theme.bg).frame(height: 36).padding(.horizontal, -4)
                    }
                }
            }
            Spacer(minLength: 0)
            SpeedSlider(width: model.layout.sidebar.width - 36)
            Text("Seed \(v.seed)").font(Theme.font(12)).foregroundStyle(Theme.inkFaint)
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 18).padding(.vertical, 14)
        .frame(width: model.layout.sidebar.width, height: model.layout.sidebar.height, alignment: .topLeading)
        .background(Theme.sidebar)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.brassDim).frame(width: 3) }
    }

    private func stat(_ label: String, _ value: String, color: Color = Theme.ink, trailing: Bool = false) -> some View {
        VStack(alignment: trailing ? .trailing : .leading, spacing: 0) {
            Text(label).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
            Text(value).font(Theme.font(28, .bold)).monospacedDigit().foregroundStyle(color).inkShadow()
                .contentTransition(.numericText())
        }
    }
}

struct ProgressBar: View {
    let fraction: Double
    let color: Color
    var height = 10.0
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.bg)
                Capsule().fill(color).frame(width: g.size.width * min(1, max(0, fraction)))
            }
        }
        .frame(height: height)
    }
}

/// Lays children out in rows, wrapping.
struct FlowRow: Layout {
    var spacing = 8.0
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 240
        var x = 0.0, y = 0.0, row = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 { x = 0; y += row + 4; row = 0 }
            x += size.width + spacing
            row = max(row, size.height)
        }
        return CGSize(width: width, height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += row + 4; row = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}
