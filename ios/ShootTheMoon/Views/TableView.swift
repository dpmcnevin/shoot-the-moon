import SwiftUI

/// The table. Every card is one keyed view in a single layer: your hand, the
/// opponents' face-down hands, the kitty, the trick and the held trick. When
/// a card changes place (played, passed, received) it keeps its identity, so
/// SwiftUI springs it to its new spot and flips it on the way.
struct TableView: View {
    @Environment(GameModel.self) private var model
    @State private var drag: (id: Int, at: CGPoint, moved: Bool)?

    private var L: TableLayout { model.layout }

    struct Placement: Identifiable {
        let id: String
        let card: CardV?
        let faceUp: Bool
        let x, y, r, s: Double
        let z: Double
        var lift = 0.0
        var highlight: Color? = nil
        var dim = false
        var from: (Double, Double)? = nil
        var to: (Double, Double)? = nil
        var delay = 0.0
    }

    var body: some View {
        if let v = model.view {
            ZStack(alignment: .topLeading) {
                oval
                labels(v)
                ForEach(placements(v)) { p in
                    CardView(card: p.card, faceUp: p.faceUp, highlight: p.highlight, dim: p.dim, lift: p.lift)
                        .scaleEffect(p.s)
                        .rotationEffect(.radians(p.r))
                        .position(x: p.x, y: p.y)
                        .zIndex(p.z)
                        .transition(transition(p))
                }
                handHitZones(v)
                if v.phase == .pass { PassBar() }
                if v.phase == .play {
                    GameButton("Play it out", style: .plain, size: .small) { model.playOut() }
                        .frame(width: 160)
                        .position(x: L.W - 100, y: L.handY - 50)
                        .zIndex(90)
                }
                trickText(v)
            }
            .frame(width: L.W, height: L.H)
            .animation(.spring(duration: 0.5, bounce: 0.22), value: animationKey(v))
        }
    }

    /// Changes whenever cards should move.
    private func animationKey(_ v: GameView) -> String {
        "\(model.deal)|\(v.hand.mine.count)|\(v.hand.trick.count)|\(v.hand.tricksPlayed)|\(model.trickHold?.index ?? -1)|\(model.passPick)|\(model.handOrder)|\(drag?.id ?? -1)|\(Int(drag?.at.x ?? 0) / 8)|\(Int(drag?.at.y ?? 0) / 8)|\(model.hovered ?? -1)|\(v.phase)"
    }

    private func transition(_ p: Placement) -> AnyTransition {
        let insertion: AnyTransition = p.from.map { f in
            AnyTransition.offset(x: f.0 - p.x, y: f.1 - p.y).animation(.spring(duration: 0.55, bounce: 0.2).delay(p.delay))
        } ?? .opacity
        let removal: AnyTransition = p.to.map { t in
            AnyTransition.offset(x: t.0 - p.x, y: t.1 - p.y).combined(with: .scale(scale: 0.5)).combined(with: .opacity)
        } ?? .opacity
        return .asymmetric(insertion: insertion, removal: removal)
    }

    // MARK: - Placements

    private func placements(_ v: GameView) -> [Placement] {
        var out: [Placement] = []
        let key = { (id: Int) in "\(model.deal)-\(id)" }
        let hand = v.hand

        // Your hand, with a live preview while dragging.
        var mine = model.orderedHand()
        if let d = drag, d.moved, let from = mine.firstIndex(where: { $0.id == d.id }) {
            let card = mine.remove(at: from)
            let slots = L.handSlots(mine.count + 1)
            var index = 0
            for (i, s) in slots.enumerated() where i < mine.count + 1 && s.cx < d.at.x { index = i + 1 }
            mine.insert(card, at: min(index, mine.count))
        }
        let slots = L.handSlots(mine.count)
        let passing = v.phase == .pass
        for (i, c) in mine.enumerated() {
            let s = slots[i]
            let picked = model.passPick.contains(c.id)
            let legal = model.isLegal(c.id)
            let hovered = model.hovered == c.id && (legal || passing)
            let lift = picked ? 30.0 : hovered ? 22 : (legal ? 8 : 0)
            let received = hand.received.contains(c.id) && hand.tricksPlayed == 0
            var p = Placement(
                id: key(c.id), card: c, faceUp: true, x: s.cx, y: s.cy - lift,
                r: picked || hovered ? 0 : s.r, s: hovered ? 1.1 : 1, z: hovered ? 45 : 10 + Double(i), lift: lift,
                highlight: picked ? Theme.ploy : (received || hovered ? Theme.brass : nil),
                dim: hand.isPlayerTurn && model.trickHold == nil && !legal)
            if let d = drag, d.moved, d.id == c.id {
                let drop = legal && L.isOverTrick(d.at)
                p = Placement(id: key(c.id), card: c, faceUp: true, x: d.at.x, y: d.at.y, r: 0, s: 1.14, z: 95,
                              lift: 26, highlight: drop ? Theme.good : nil)
            }
            if received, let from = hand.receivedFrom { p.from = L.origin(from) }
            if !received { p.from = L.origin(Seat.player); p.delay = Double(i) * 0.04 }
            out.append(p)
        }

        // Opponents' face-down hands.
        for seat in [Seat.west, Seat.north, Seat.east] {
            let ids = hand.opponentCards(seat)
            let spots = L.opponentSlots(seat, ids.count)
            let s = L.seats[seat]!
            for (i, id) in ids.enumerated() {
                out.append(Placement(id: key(id), card: nil, faceUp: false, x: spots[i].x, y: spots[i].y,
                                     r: s.r, s: s.s, z: 5 + Double(i), from: L.origin(seat), delay: 0.15 + Double(i) * 0.03))
            }
        }

        // The kitty, face down beside the trick until the first trick wins it.
        for (i, id) in hand.kitty.enumerated() {
            out.append(Placement(id: key(id), card: nil, faceUp: false,
                                 x: L.tableCX + L.ovalRX - 64 + Double(i) * 7, y: L.trickCY - L.ovalRY + 64 + Double(i) * 3,
                                 r: 0.2 + Double(i) * 0.08, s: 0.55, z: 4 + Double(i), from: (L.tableCX, L.trickCY), delay: 0.3))
        }

        // The trick in progress, or the one being held.
        if let held = model.trickHold {
            let to = L.origin(held.winner)
            for (i, p) in held.plays.enumerated() {
                let (x, y) = L.trickPoint(p.seat)
                let won = p.seat == held.winner
                out.append(Placement(id: key(p.card.id), card: p.card, faceUp: true, x: x, y: y, r: tossAngle(p.card),
                                     s: won ? 1.08 : 1, z: 60 + Double(i), lift: won ? 10 : 2,
                                     highlight: won ? (held.points > 0 ? Theme.bad : Theme.brass) : nil,
                                     from: L.origin(p.seat), to: to))
            }
            for (i, c) in held.kitty.enumerated() {
                out.append(Placement(id: key(c.id), card: c, faceUp: true, x: L.tableCX + 150 + Double(i) * 24,
                                     y: L.trickCY - 90, r: 0.15, s: 0.7, z: 58, to: to))
            }
        } else {
            for (i, p) in hand.trick.enumerated() {
                let (x, y) = L.trickPoint(p.seat)
                out.append(Placement(id: key(p.card.id), card: p.card, faceUp: true, x: x, y: y, r: tossAngle(p.card),
                                     s: 1, z: 60 + Double(i), lift: 2, from: L.origin(p.seat)))
            }
        }
        return out
    }

    // MARK: - Input

    /// Stable hit zones for your hand (the sprites move; these don't).
    private func handHitZones(_ v: GameView) -> some View {
        let mine = model.orderedHand()
        let slots = L.handSlots(mine.count)
        return ForEach(Array(mine.enumerated()), id: \.element.id) { i, c in
            let s = slots[i]
            Color.white.opacity(0.001)
                .frame(width: s.w, height: TableLayout.cardH + 30)
                .position(x: s.x + s.w / 2, y: L.handY + TableLayout.cardH / 2 - 15)
                .zIndex(80)
                .onHover { inside in model.hovered = inside ? c.id : (model.hovered == c.id ? nil : model.hovered) }
                .gesture(
                    DragGesture(minimumDistance: 0, coordinateSpace: .named("stage"))
                        .onChanged { g in
                            let moved = (drag?.moved ?? false) || hypot(g.translation.width, g.translation.height) > 8
                            if moved && !(drag?.moved ?? false) { model.audio.play("card_hover", volume: 0.6, jitter: 0.1) }
                            drag = (c.id, g.location, moved)
                        }
                        .onEnded { g in
                            let d = drag
                            drag = nil
                            guard let d, d.moved else { return tap(c) }
                            if model.isLegal(c.id) && L.isOverTrick(g.location) { return model.play(c.id) }
                            var index = 0
                            for (j, s) in slots.enumerated() where mine[j].id != c.id && s.cx < g.location.x { index += 1 }
                            model.move(c.id, toIndex: index)
                        }
                )
        }
    }

    private func tap(_ c: CardV) {
        if model.skip() { return }
        if model.view?.phase == .pass { return model.togglePass(c.id) }
        model.play(c.id)
    }

    // MARK: - Decoration

    private var oval: some View {
        Ellipse()
            .fill(Theme.feltEdge.opacity(0.55))
            .overlay(Ellipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2))
            .overlay(Ellipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2).padding(8))
            .frame(width: L.ovalRX * 2, height: L.ovalRY * 2)
            .position(x: L.tableCX, y: L.trickCY)
    }

    private func labels(_ v: GameView) -> some View {
        ZStack {
            ForEach([Seat.west, Seat.north, Seat.east], id: \.self) { seat in
                let s = L.seats[seat]!
                seatLabel(v.seatName(seat).uppercased(), points: v.hand.points[seat], active: v.hand.turn == seat)
                    .position(x: s.labelX, y: s.labelY)
            }
            seatLabel("SOUTH · You", points: v.hand.points[Seat.player], active: v.hand.turn == Seat.player,
                      note: model.isLegal(v.hand.legal.first ?? -1) ? "Your play" : nil)
                .position(x: L.tableCX, y: L.handY - 44)
            if !v.hand.kitty.isEmpty {
                Text("Kitty · \(v.hand.kitty.count)").font(Theme.font(12)).foregroundStyle(Theme.inkDim)
                    .position(x: L.tableCX + L.ovalRX - 64, y: L.trickCY - L.ovalRY + 112)
            }
        }
    }

    private func seatLabel(_ name: String, points: Int, active: Bool, note: String? = nil) -> some View {
        HStack(spacing: 6) {
            Text(name).foregroundStyle(active ? Theme.brass : Theme.inkDim).inkShadow()
            if points > 0 {
                Text("\(points)").font(Theme.font(13, .bold)).foregroundStyle(Theme.ink)
                    .padding(.horizontal, 7).background(Capsule().fill(Theme.bad))
            }
            if let note { Text(note).foregroundStyle(Theme.brass) }
        }
        .font(Theme.font(14))
    }

    @ViewBuilder
    private func trickText(_ v: GameView) -> some View {
        if let t = model.trickHold {
            let you = t.winner == Seat.player
            let text = you
                ? (t.points > 0 ? "You take \(t.points) point\(t.points > 1 ? "s" : "")" : "Your trick, no points")
                : (t.points > 0 ? "\(v.seatName(t.winner)) takes \(t.points)" : "\(v.seatName(t.winner))'s trick")
            Text(text)
                .font(Theme.font(20, .bold))
                .foregroundStyle(you && t.points > 0 ? Theme.bad : Theme.good)
                .inkShadow()
                .position(x: L.tableCX, y: L.trickCY + 150)
                .zIndex(75)
        }
    }
}

/// Pick three cards to pass.
struct PassBar: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let arrow = v.hand.passDir == "left" ? "←" : v.hand.passDir == "right" ? "→" : "↑"
        VStack(spacing: 6) {
            Text("Pass three cards \(v.hand.passDir)\(v.hand.passTo.map { " to \($0)" } ?? "")")
                .font(Theme.font(22, .bold))
            Text("\(model.passPick.count) of 3 chosen · tap cards to pick them")
                .font(Theme.font(14)).foregroundStyle(Theme.inkDim)
            GameButton("Pass \(arrow)", enabled: model.passPick.count == 3, pulse: true) { model.commitPass() }
                .frame(width: 200)
                .padding(.top, 6)
        }
        .padding(14)
        .frame(width: 420)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.sidebar).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.ploy, lineWidth: 2))
        .position(x: model.layout.tableCX, y: model.layout.trickCY)
        .zIndex(85)
    }
}
