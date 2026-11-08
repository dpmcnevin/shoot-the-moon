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
                    GameButton("Last trick", style: .plain, size: .small,
                               enabled: v.hand.lastTrick != nil && model.trickHold == nil) { model.showLastTrick = true }
                        .frame(width: 160)
                        .position(x: L.W - 100, y: L.handY - 96)
                        .zIndex(90)
                    GameButton("Play it out", style: .plain, size: .small) { model.playOut() }
                        .frame(width: 160)
                        .position(x: L.W - 100, y: L.handY - 50)
                        .zIndex(90)
                }
                if model.showLastTrick, let t = v.hand.lastTrick {
                    LastTrickPanel(trick: t)
                        .frame(width: L.W, height: L.H)
                        .zIndex(130)
                        .transition(.opacity)
                }
                trickText(v)
            }
            .frame(width: L.W, height: L.H)
            .animation(.spring(duration: 0.5, bounce: 0.22), value: animationKey(v))
            .animation(.easeOut(duration: 0.15), value: model.showLastTrick)
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
            let lift = (picked ? 30.0 : hovered ? 22 : (legal ? 8 : 0)) * L.handScale
            let received = hand.received.contains(c.id) && hand.tricksPlayed == 0
            let blind = passing && v.bossNow("blindfold")
            var p = Placement(
                id: key(c.id), card: c, faceUp: !blind, x: s.cx, y: s.cy - lift,
                r: picked || hovered ? 0 : s.r, s: (hovered ? 1.1 : 1) * L.handScale, z: hovered ? 45 : 10 + Double(i), lift: lift,
                highlight: picked ? Theme.ploy : (received || hovered ? Theme.brass : nil),
                dim: hand.isPlayerTurn && model.trickHold == nil && !legal)
            if let d = drag, d.moved, d.id == c.id {
                let drop = legal && L.isOverTrick(d.at)
                p = Placement(id: key(c.id), card: c, faceUp: true, x: d.at.x, y: d.at.y, r: 0, s: 1.14 * L.handScale, z: 95,
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
            let fog = v.bossNow("fog")
            for (i, p) in hand.trick.enumerated() {
                let (x, y) = L.trickPoint(p.seat)
                out.append(Placement(id: key(p.card.id), card: p.card, faceUp: !fog || i == 0 || p.seat == Seat.player,
                                     x: x, y: y, r: tossAngle(p.card),
                                     s: 1, z: 60 + Double(i), lift: 2, from: L.origin(p.seat)))
            }
        }
        return out
    }

    // MARK: - Input

    /// How far a finger must travel before a touch is a drag, not a tap.
    /// Fingers wobble; too small and taps rearrange the hand instead.
    private static let dragThreshold = 22.0

    /// Stable hit zones for your hand (the sprites move; these don't). Each
    /// zone is the strip of its card left showing, tilted and dropped along
    /// the fan like the card, and reaching up over a lifted card.
    private func handHitZones(_ v: GameView) -> some View {
        let mine = model.orderedHand()
        let slots = L.handSlots(mine.count)
        let cw = L.handCardW, ch = L.handCardH, reach = 34 * L.handScale
        return ForEach(Array(mine.enumerated()), id: \.element.id) { i, c in
            let s = slots[i]
            ZStack(alignment: .topLeading) {
                Color.clear.frame(width: cw, height: ch + reach)
                Color.white.opacity(0.001)
                    .frame(width: s.w, height: ch + reach)
                    .contentShape(Rectangle())
                    .gesture(cardGesture(c, mine: mine, slots: slots))
            }
            .frame(width: cw, height: ch + reach, alignment: .topLeading)
            .rotationEffect(.radians(s.r), anchor: UnitPoint(x: 0.5, y: (reach + ch / 2) / (ch + reach)))
            .position(x: s.cx, y: s.cy - reach / 2)
            .zIndex(80 + Double(i) * 0.01)
            .onHover { inside in model.hovered = inside ? c.id : (model.hovered == c.id ? nil : model.hovered) }
        }
    }

    private func cardGesture(_ c: CardV, mine: [CardV], slots: [TableLayout.Slot]) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("stage"))
            .onChanged { g in
                let moved = (drag?.moved ?? false) || hypot(g.translation.width, g.translation.height) > Self.dragThreshold
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
    }

    private func tap(_ c: CardV) {
        // A tap while a finished trick is still showing clears it and, if
        // it's now your lead, plays the card too: one tap, not two.
        if model.trickHold != nil {
            model.endTrickHold()
            return model.play(c.id)
        }
        if model.skip() { return }
        if model.view?.phase == .pass { return model.togglePass(c.id) }
        model.play(c.id)
    }

    // MARK: - Decoration

    private var oval: some View {
        PixelEllipse()
            .fill(Theme.feltEdge.opacity(0.55))
            .overlay(PixelEllipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2))
            .overlay(PixelEllipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2).padding(8))
            .frame(width: L.ovalRX * 2, height: L.ovalRY * 2)
            .position(x: L.tableCX, y: L.trickCY)
    }

    private func labels(_ v: GameView) -> some View {
        ZStack {
            ForEach([Seat.west, Seat.north, Seat.east], id: \.self) { seat in
                let s = L.seats[seat]!
                let shark = v.bossNow("shark") && seat == v.boss?.sharkSeat
                VStack(spacing: 4) {
                    seatLabel(v.seatName(seat).uppercased() + (shark ? " · SHARK" : ""), points: v.hand.points[seat],
                              active: v.hand.turn == seat, alert: shark)
                    // Card Counter: the suits this seat has run out of.
                    if let out = v.hand.voids?[String(seat)], !out.isEmpty {
                        HStack(spacing: 4) {
                            Text("OUT").font(Theme.font(11, .bold)).kerning(1).foregroundStyle(Theme.inkDim)
                            ForEach(out.sorted(), id: \.self) { suit in
                                PixelSprite(rows: PixelSprite.suits[suit] ?? [], color: suitColor(suit))
                            }
                        }
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(PixelRect(radius: 4).fill(Theme.sidebar.opacity(0.85)))
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(v.seatName(seat)) is out of \(out.map(suitName).joined(separator: ", "))")
                    }
                }
                .position(x: s.labelX, y: s.labelY + (v.hand.voids?[String(seat)]?.isEmpty == false ? 12 : 0))
            }
            seatLabel("SOUTH · You", points: v.hand.points[Seat.player], active: v.hand.turn == Seat.player,
                      note: model.isLegal(v.hand.legal.first ?? -1) ? "Your play" : nil)
                .position(x: L.tableCX, y: L.handY - 16 - 30 * L.handScale) // above a picked card
            if !v.hand.kitty.isEmpty {
                Text("Kitty · \(v.hand.kitty.count)").font(Theme.font(12)).foregroundStyle(Theme.inkDim)
                    .position(x: L.tableCX + L.ovalRX - 64, y: L.trickCY - L.ovalRY + 112)
            }
        }
    }

    private func suitColor(_ suit: Int) -> Color {
        switch suit {
        case 1: model.fourColor ? Color(hex: 0x4fbf7a) : Theme.ink
        case 2: model.fourColor ? Color(hex: 0xf5b46a) : Color(hex: 0xf08a8a)
        case 3: Color(hex: 0xf08a8a)
        default: Theme.ink
        }
    }

    private func suitName(_ suit: Int) -> String {
        [1: "clubs", 2: "diamonds", 3: "hearts", 4: "spades"][suit] ?? "?"
    }

    private func seatLabel(_ name: String, points: Int, active: Bool, note: String? = nil, alert: Bool = false) -> some View {
        HStack(spacing: 6) {
            Text(name).foregroundStyle(active ? Theme.brass : alert ? Theme.bad : Theme.inkDim).inkShadow()
            if points > 0 {
                Text("\(points)").font(Theme.font(13, .bold)).foregroundStyle(Theme.ink)
                    .padding(.horizontal, 7).background(PixelRect(radius: 4).fill(Theme.bad))
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
            Text(v.bossNow("blindfold") ? "Blindfolded: \(model.passPick.count) of 3 chosen, unseen" : "\(model.passPick.count) of 3 chosen · tap cards to pick them")
                .font(Theme.font(14)).foregroundStyle(Theme.inkDim)
            GameButton("Pass \(arrow)", enabled: model.passPick.count == 3, pulse: true) { model.commitPass() }
                .frame(width: 200)
                .padding(.top, 6)
        }
        .padding(14)
        .frame(width: 420)
        .background(PixelRect(radius: 10).fill(Theme.sidebar).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(PixelRect(radius: 10).stroke(Theme.ploy, lineWidth: 2))
        .position(x: model.layout.tableCX, y: model.layout.trickCY)
        .zIndex(85)
    }
}

/// The last finished trick: the four cards in the order they were played,
/// who played each, and who took it. Tap anywhere to close.
struct LastTrickPanel: View {
    @Environment(GameModel.self) private var model
    let trick: TrickV

    var body: some View {
        let v = model.view!
        let L = model.layout
        let name = { (s: Int) in s == Seat.player ? "You" : v.seatName(s) }
        let took = trick.winner == Seat.player ? "You took it" : "\(name(trick.winner)) took it"
        ZStack {
            Color.black.opacity(0.4)
            Panel(edge: trick.points > 0 ? Theme.bad : Theme.brass) {
                VStack(spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Trick \(trick.index)").font(Theme.font(26, .bold)).foregroundStyle(Theme.brass).inkShadow()
                        Spacer()
                        Text(trick.points > 0 ? "\(took) · \(trick.points) point\(trick.points == 1 ? "" : "s")" : took)
                            .font(Theme.font(18)).foregroundStyle(trick.points > 0 ? Theme.bad : Theme.ink)
                    }
                    HStack(spacing: 18) {
                        ForEach(Array(trick.plays.enumerated()), id: \.offset) { i, p in
                            VStack(spacing: 8) {
                                CardView(card: p.card, faceUp: true,
                                         highlight: p.seat == trick.winner ? (trick.points > 0 ? Theme.bad : Theme.brass) : nil,
                                         lift: p.seat == trick.winner ? 8 : 2)
                                    .scaleEffect(1.25)
                                    .frame(width: TableLayout.cardW * 1.25, height: TableLayout.cardH * 1.25)
                                Text(name(p.seat)).font(Theme.font(16))
                                    .foregroundStyle(p.seat == trick.winner ? Theme.brass : Theme.inkDim)
                                Text(i == 0 ? "led" : " ").font(Theme.font(12)).foregroundStyle(Theme.inkFaint)
                            }
                        }
                    }
                    if !trick.kitty.isEmpty {
                        Text("Plus the kitty: \(trick.kitty.map(\.name).joined(separator: " "))")
                            .font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                    }
                    Text("tap to close").font(Theme.font(13)).foregroundStyle(Theme.inkFaint)
                }
                .padding(.horizontal, 26).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 560)
            .position(x: L.tableCX, y: L.trickCY)
        }
        .contentShape(Rectangle())
        .onTapGesture { model.showLastTrick = false }
    }
}
