import SwiftUI

/// The hand's score, counted up line by line, then chips x mult.
struct ScorePanel: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        // While the panel animates out, the next hand has already cleared the
        // result, so draw nothing rather than unwrap it.
        if let v = model.view, let r = v.result { panel(v, r) }
    }

    private func panel(_ v: GameView, _ r: ResultV) -> some View {
        let shown = Array(r.lines.prefix(model.revealShown))
        var chips = 0.0, mult = 1.0
        for l in shown {
            chips += l.chips ?? 0
            mult += l.mult ?? 0
            mult *= l.xmult ?? 1
        }
        let good = r.shooter == Seat.player || (r.shooter == nil && r.myPoints <= 6)
        let title = r.shooter == Seat.player ? "You shot the moon!"
            : r.shooter != nil ? "\(v.seatName(r.shooter!)) shot the moon"
            : r.myPoints == 0 ? "Clean hand!" : "You took \(r.myPoints) point\(r.myPoints == 1 ? "" : "s")"
        let boardShown = v.score - (model.revealDone ? 0 : r.total)
        let next = v.score >= v.target ? "Board won!" : v.handsLeft <= 0 ? "Out of hands" : "Next hand (\(v.handsLeft) left)"

        return Panel(edge: good ? Theme.good : Theme.bad) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(Theme.font(28, .bold)).foregroundStyle(good ? Theme.good : Theme.bad).inkShadow()
                HStack(spacing: 18) {
                    ForEach([Seat.player, Seat.west, Seat.north, Seat.east], id: \.self) { s in
                        Text("\(s == Seat.player ? "You" : v.seatName(s)) \(Text("\(r.points[s])").bold())")
                            .foregroundStyle(s == Seat.player ? Theme.ink : Theme.inkDim)
                    }
                }
                .font(Theme.font(16))
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.offset) { _, line in
                        HStack {
                            Text(line.label).foregroundStyle(line.edition.map { Edition.color($0) } ?? Theme.ink)
                            Spacer()
                            if let m = line.money { Text("+$\(m)").foregroundStyle(Theme.brass) }
                            if let c = line.chips, c != 0 { Text("+\(num(c))").foregroundStyle(Theme.chips) }
                            if let m = line.mult, m != 0 { Text("+\(m, specifier: "%.2f") mult").foregroundStyle(Theme.mult) }
                            if let x = line.xmult, x != 1 { Text("x\(x, specifier: "%.2f")").foregroundStyle(Theme.mult) }
                        }
                        .font(Theme.font(17)).monospacedDigit()
                        .frame(height: 25)
                        .transition(.move(edge: .leading).combined(with: .opacity))
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, 8)
                Divider().overlay(Theme.panelEdge)
                HStack(spacing: 8) {
                    pill(num(chips), Theme.chips)
                    Text("x").font(Theme.font(28)).foregroundStyle(Theme.inkDim)
                    pill(String(format: "%.2f", mult), Theme.mult)
                    Spacer()
                    if model.revealDone {
                        Text("= \(num(r.total))").font(Theme.font(30, .bold)).inkShadow(3)
                            .transition(.scale(scale: 1.25).combined(with: .opacity))
                    }
                }
                .frame(height: 50)
                Text("Board \(num(boardShown)) / \(num(v.target))").font(Theme.font(17))
                ProgressBar(fraction: Double(boardShown) / Double(max(1, v.target)),
                            color: v.score >= v.target && model.revealDone ? Theme.good : Theme.brass, height: 12)
                HStack {
                    Spacer()
                    if model.revealDone {
                        GameButton(next, pulse: true) { model.continueAfterHand() }.frame(width: 220)
                    } else {
                        Text("tap to skip").font(Theme.font(14)).foregroundStyle(Theme.inkFaint).frame(height: 44)
                    }
                }
            }
            .padding(.horizontal, 30).padding(.vertical, 18)
            .foregroundStyle(Theme.ink)
        }
        .frame(width: 580, height: 500)
        .animation(.spring(duration: 0.3), value: model.revealShown)
        .animation(.spring(duration: 0.3), value: model.revealDone)
        .contentShape(Rectangle())
        .onTapGesture { _ = model.skip() }
    }

    private func pill(_ text: String, _ color: Color) -> some View {
        Text(text).font(Theme.font(28, .bold)).monospacedDigit().contentTransition(.numericText())
            .padding(.horizontal, 12).padding(.vertical, 2)
            .background(PixelRect(radius: 8).fill(color))
    }
}

/// Board won: the payout, itemised, and the way into the club. Like a
/// cash-out, the rows come in one by one with dollar pips, and the total
/// counts up a dollar at a time (the sidebar's money with it). A tap on the
/// panel skips to the end.
struct BoardWonPanel: View {
    @Environment(GameModel.self) private var model
    @State private var shown = 0
    @State private var counted = 0
    @State private var skipped = false

    var body: some View {
        if let v = model.view, let p = v.payout {
            panel(v, p)
                .task { await countUp(v, p) }
                .onDisappear { model.moneyShown = nil }
        }
    }

    private func rows(_ p: PayoutV) -> [(String, Int)] {
        var rows: [(String, Int)] = [("Board", p.board), ("Unused hands", p.unused), ("Interest", p.interest)]
        if p.relics > 0 { rows.append(("Relics", p.relics)) }
        if let b = p.boss, b > 0 { rows.append(("Boss beaten", b)) }
        if let o = p.overshoot, o > 0 { rows.append(("Beat the goal by \(o * 50)%+", o)) }
        return rows
    }

    private func countUp(_ v: GameView, _ p: PayoutV) async {
        let list = rows(p)
        let start = v.money - p.total
        let pace = 1 / max(0.5, model.speed)
        func wait(_ s: Double) async { try? await Task.sleep(for: .seconds(s * pace)) }
        model.moneyShown = start
        await wait(0.45)
        while shown < list.count && !skipped {
            shown += 1
            let amount = list[shown - 1].1
            model.audio.play("tick", pitch: amount > 0 ? 1.1 : 0.85, volume: 0.6)
            await wait(amount > 0 ? 0.3 : 0.2)
        }
        while counted < p.total && !skipped {
            counted += 1
            model.moneyShown = start + counted
            model.audio.play("coin", pitch: Float(0.9 + min(0.6, Double(counted) * 0.05)), volume: 0.5)
            await wait(max(0.07, 0.26 - Double(counted) * 0.025))
        }
        finish(p)
    }

    private func finish(_ p: PayoutV) {
        skipped = true
        shown = rows(p).count
        counted = p.total
        model.moneyShown = nil
    }

    private func panel(_ v: GameView, _ p: PayoutV) -> some View {
        let rows = rows(p)
        return Panel(edge: Theme.brass) {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(v.boardName) won").font(Theme.font(28, .bold)).foregroundStyle(Theme.good).inkShadow()
                Text(v.board == v.boardsPerTable
                     ? (v.table >= v.tables ? "That was the last table." : "Table \(v.table) of \(v.tables) cleared. Next: table \(v.table + 1).")
                     : "Table \(v.table) of \(v.tables) · next: \(v.board + 1 == v.boardsPerTable ? "the High Board" : "Board \(v.board + 1)")")
                    .font(Theme.font(16)).foregroundStyle(Theme.brass)
                Text("\(num(v.score)) scored against a target of \(num(v.target))").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                VStack(spacing: 4) {
                    ForEach(Array(rows.enumerated()), id: \.element.0) { i, row in
                        HStack {
                            Text(row.0)
                            Spacer()
                            HStack(spacing: 3) {
                                ForEach(0..<min(row.1, 10), id: \.self) { _ in
                                    PixelRect(radius: 2).fill(Theme.brass).frame(width: 8, height: 8)
                                }
                            }
                            Text("$\(row.1)").foregroundStyle(row.1 > 0 ? Theme.brass : Theme.inkFaint)
                        }
                        .opacity(i < shown ? 1 : 0)
                        .offset(x: i < shown ? 0 : -12)
                        .animation(.easeOut(duration: 0.15), value: shown)
                    }
                    Divider().overlay(Theme.panelEdge)
                    HStack { Text("Total").bold(); Spacer(); Text("$\(counted)").bold().foregroundStyle(Theme.brass).contentTransition(.numericText()) }.font(Theme.font(20))
                }
                .font(Theme.font(17))
                .padding(.top, 10)
                HStack { Spacer(); GameButton("Enter the club", pulse: skipped, sound: nil) { finish(p); model.enterShop() }.frame(width: 200) }
                    .padding(.top, 10)
            }
            .padding(.horizontal, 30).padding(.vertical, 18)
            .foregroundStyle(Theme.ink)
        }
        .contentShape(Rectangle())
        .onTapGesture { if !skipped { finish(p) } }
        .frame(width: 460)
    }
}

struct EndingPanel: View {
    @Environment(GameModel.self) private var model
    let victory: Bool

    var body: some View {
        if let v = model.view { panel(v) }
    }

    private func panel(_ v: GameView) -> some View {
        let s = v.stats
        let rows: [(String, String)] = [
            ("Hands played", "\(s.handsPlayed)"), ("Moons shot", "\(s.moons)"), ("Clean hands", "\(s.cleanHands)"),
            ("Points taken", "\(s.pointsTaken)"), ("Best hand", num(s.bestHand)), ("Seed", v.seed)
        ]
        return Panel(edge: victory ? Theme.brass : Theme.bad) {
            VStack(alignment: .leading, spacing: 10) {
                Text(victory ? "Moon over the club!" : "Out of hands")
                    .font(Theme.font(44, .bold)).foregroundStyle(victory ? Theme.brass : Theme.bad).inkShadow(4)
                Text(victory ? "You beat all eight tables."
                     : "Fell on \(v.boardName) of table \(v.table), \(num(max(0, v.target - v.score))) short.")
                    .font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                VStack(spacing: 4) {
                    ForEach(rows, id: \.0) { r in HStack { Text(r.0); Spacer(); Text(r.1).foregroundStyle(Theme.brass) } }
                }
                .font(Theme.font(17)).padding(.top, 10)
                HStack {
                    GameButton("Main menu", style: .plain) { model.toMenu() }.frame(width: 170)
                    Spacer()
                    GameButton("New run", pulse: true) { model.seedInput = ""; model.newRun() }.frame(width: 170)
                }
                .padding(.top, 14)
            }
            .padding(.horizontal, 30).padding(.vertical, 20)
            .foregroundStyle(Theme.ink)
        }
        .frame(width: 520)
    }
}
