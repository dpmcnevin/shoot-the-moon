import SwiftUI
import Observation

/// The app's controller: screens, timing, sound cues, saving and input.
/// Mirrors the web game's controller (src/lib/app/game.svelte.ts). All rules
/// live in the JavaScript engine; this decides what the player sees, when,
/// and what it sounds like.
@Observable
@MainActor
final class GameModel {
    enum Screen { case menu, run }

    struct Toast: Equatable {
        let text: String
        let color: Color
        let id = UUID()
    }

    struct Burst: Identifiable {
        let id = UUID()
        let x: Double, y: Double
        let colors: [Color]
        let count: Int
        let speed: Double
        let life: Double
        let size: Double
        let start: Date
        let seed: UInt64
    }

    // Timing, as in the web game, at 1x play speed.
    static let aiDelay = 0.45
    static let trickHold = 1.0
    static let revealStep = 0.3
    static let speedRange = 0.5...3.0

    private var aiSeconds: Double { Self.aiDelay / speed }
    private var holdSeconds: Double { Self.trickHold / speed }
    private var revealSeconds: Double { Self.revealStep / speed }

    let engine: GameEngine
    let art: PixelArt
    let audio = AudioPlayer()

    private(set) var view: GameView?
    var screen: Screen = .menu
    var showHelp = false
    var seedInput = ""

    /// Cards picked to pass.
    var passPick: [Int] = []
    /// A finished trick held on the table for a moment.
    private(set) var trickHold: TrickV?
    /// The score count-up.
    private(set) var revealShown = 0
    private(set) var revealDone = false
    private(set) var toast: Toast?
    /// Shop slot of a seal or pack item waiting for a card.
    var pickerSlot: Int?
    /// Your own order for your hand (card ids), for the rest of the deal.
    var handOrder: [Int] = []
    /// Bumped on each new deal so card views are re-keyed.
    private(set) var deal = 0
    private(set) var bursts: [Burst] = []
    private(set) var shakeUntil = Date.distantPast
    private(set) var shakeAmount = 0.0
    var hovered: Int?

    // Settings, remembered between launches.
    var music: Bool { didSet { UserDefaults.standard.set(music, forKey: "music"); audio.musicEnabled = music } }
    var sfx: Bool { didSet { UserDefaults.standard.set(sfx, forKey: "sfx"); audio.sfxEnabled = sfx } }
    var fourColor: Bool { didSet { UserDefaults.standard.set(fourColor, forKey: "fourColor") } }
    /// How fast the opponents play and the table moves on: 0.5x to 3x.
    var speed: Double { didSet { UserDefaults.standard.set(speed, forKey: "speed") } }

    private var lastPhase: Phase?
    private var aiTask: Task<Void, Never>?
    private var streak = 0
    private static let saveKey = "shoot-the-moon.save"

    init() throws {
        let engine = try GameEngine()
        self.engine = engine
        self.art = PixelArt(engine: engine)
        let d = UserDefaults.standard
        music = d.object(forKey: "music") as? Bool ?? true
        sfx = d.object(forKey: "sfx") as? Bool ?? true
        fourColor = d.object(forKey: "fourColor") as? Bool ?? true
        speed = (d.object(forKey: "speed") as? Double ?? 1).clamped(to: Self.speedRange)
        audio.musicEnabled = music
        audio.sfxEnabled = sfx
        restore()
    }

    var layout = TableLayout.make(height: 720)
    var hasLiveRun: Bool {
        guard let v = view else { return false }
        return v.phase != .gameOver && v.phase != .victory
    }

    // MARK: - Saving

    private func restore() {
        guard let save = UserDefaults.standard.string(forKey: Self.saveKey) else { return }
        do {
            let v = try engine.restore(save)
            apply(v, entering: false)
            lastPhase = v.phase
            // Reopened on the score panel: the hand was counted up before the
            // app closed, so show it finished rather than waiting on a
            // count-up that never starts.
            if v.phase == .handScored, let r = v.result {
                revealShown = r.lines.count
                revealDone = true
            }
        } catch {
            print("saved run could not be restored: \(error)")
            UserDefaults.standard.removeObject(forKey: Self.saveKey)
        }
    }

    private func persist() {
        guard let v = view else { return }
        if v.phase == .gameOver || v.phase == .victory {
            UserDefaults.standard.removeObject(forKey: Self.saveKey)
        } else if let s = try? engine.save() {
            UserDefaults.standard.set(s, forKey: Self.saveKey)
        }
    }

    // MARK: - Applying state

    @discardableResult
    private func act(_ action: Action) -> ActResult? {
        do {
            let r = try engine.act(action)
            apply(r.view, entering: true)
            persist()
            return r
        } catch {
            print("action failed: \(error)")
            return nil
        }
    }

    private func apply(_ v: GameView, entering: Bool) {
        let old = view
        // A new deal: nothing played yet, coming from outside a hand.
        let inHand = v.phase == .pass || v.phase == .play
        let wasInHand = old.map { $0.phase == .pass || $0.phase == .play } ?? false
        if inHand && v.hand.tricksPlayed == 0 && v.hand.trick.isEmpty && (!wasInHand || old?.phase == .play && v.phase == .pass) {
            deal += 1
            handOrder = []
            passPick = []
        }
        view = v
        if entering && v.phase != lastPhase {
            lastPhase = v.phase
            onPhaseEnter(v.phase)
        }
        pump()
    }

    // MARK: - Runs

    func newRun() {
        aiTask?.cancel()
        aiTask = nil
        trickHold = nil
        let seed = seedInput.trimmingCharacters(in: .whitespaces).uppercased()
        guard let v = try? engine.newRun(seed: seed.isEmpty ? nil : seed) else { return }
        view = nil
        lastPhase = nil
        apply(v, entering: true)
        screen = .run
        persist()
    }

    func continueRun() {
        screen = .run
        pump()
    }

    // MARK: - Passing and playing

    func togglePass(_ id: Int) {
        guard view?.phase == .pass else { return }
        if let i = passPick.firstIndex(of: id) {
            passPick.remove(at: i)
        } else if passPick.count < 3 {
            passPick.append(id)
        } else {
            audio.play("trick_lose", volume: 0.4)
            return
        }
        audio.play("select", pitch: 0.9 + Float(passPick.count) * 0.08)
    }

    func commitPass() {
        guard view?.phase == .pass, passPick.count == 3 else { return }
        let ids = passPick
        passPick = []
        act(.pass(ids))
        audio.play("reroll", volume: 0.7)
    }

    func isLegal(_ id: Int) -> Bool {
        guard let v = view, v.phase == .play, v.hand.isPlayerTurn, trickHold == nil else { return false }
        return v.hand.legal.contains(id)
    }

    func play(_ id: Int) {
        guard isLegal(id), let v = view, let card = v.hand.mine.first(where: { $0.id == id }) else { return }
        let wasBroken = v.hand.heartsBroken
        guard let r = act(.play(id)) else { return }
        audio.play("card_play", jitter: 0.08)
        cue(card, seat: Seat.player, wasBroken: wasBroken, brokeNow: r.brokeHearts)
        hold(r.trick, queenBroke: r.brokeHearts && !card.isHeart)
    }

    func playOut() {
        guard view?.phase == .play else { return }
        aiTask?.cancel()
        aiTask = nil
        trickHold = nil
        act(.playOut)
        audio.play("reroll")
    }

    /// Run the AI, a card at a time, whenever it's an opponent's turn.
    private func pump() {
        guard screen == .run, aiTask == nil, trickHold == nil, let v = view,
              v.phase == .play, !v.hand.isPlayerTurn else { return }
        let wait = aiSeconds
        aiTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            guard let self, !Task.isCancelled else { return }
            self.aiTask = nil
            self.aiStep()
        }
    }

    private func aiStep() {
        guard trickHold == nil, let v = view, v.phase == .play, !v.hand.isPlayerTurn else { return }
        let wasBroken = v.hand.heartsBroken
        guard let r = act(.ai) else { return }
        audio.play("card_play", jitter: 0.08)
        if let step = r.step {
            cue(step.card, seat: step.seat, wasBroken: wasBroken, brokeNow: r.brokeHearts)
            hold(r.trick, queenBroke: r.brokeHearts && !step.card.isHeart)
        }
    }

    // MARK: - Tricks

    private func cue(_ card: CardV, seat: Int, wasBroken: Bool, brokeNow: Bool) {
        let (x, y) = layout.trickPoint(seat)
        if card.isQueenOfSpades {
            audio.play("queen_played")
            shake(5)
            burst(x, y, count: 16, colors: [Theme.ink, Theme.bad], speed: 160, life: 0.5, size: 5)
        } else if card.isHeart && !wasBroken {
            audio.play("hearts_broken")
            burst(x, y, count: 22, colors: [Theme.bad, Theme.heartPink, Theme.ink], speed: 220, life: 0.8, size: 7)
            showToast("Hearts are broken!", Theme.bad)
        }
    }

    private func hold(_ trick: TrickV?, queenBroke: Bool) {
        guard let trick, let v = view else { return }
        trickHold = trick
        let (x, y) = layout.trickPoint(trick.winner)
        if trick.plays.contains(where: { $0.card.isQueenOfSpades }) {
            if trick.winner == Seat.player {
                streak = 0
                audio.play("queen_taken")
                shake(10)
                burst(x, y, count: 30, colors: [Theme.ink, Theme.bad], speed: 140, life: 1, size: 7)
                showToast(queenBroke ? "You took the queen, and hearts are broken!" : "You took the queen of spades!", Theme.bad)
            } else {
                audio.play("queen_dodged")
                burst(x, y, count: 24, colors: [Theme.good, Theme.goldLight], speed: 220, life: 0.8, size: 6)
                showToast("\(v.seatName(trick.winner)) took the queen\(queenBroke ? ", and hearts are broken" : " of spades")", Theme.good)
            }
            if queenBroke {
                Task { try? await Task.sleep(for: .seconds(0.65)); audio.play("hearts_broken", volume: 0.8) }
            }
        } else if trick.winner == Seat.player {
            if trick.points > 0 {
                streak = 0
                audio.play("trick_lose", jitter: 0.04)
            } else {
                streak += 1
                audio.play("trick_win", pitch: min(1.5, 1 + 0.06 * Float(streak - 1)), volume: 0.7)
            }
        } else if trick.points > 0 {
            audio.play("coin", volume: 0.6, jitter: 0.05)
            burst(x, y, count: 10 + trick.points, colors: [Theme.bad, Theme.ink], speed: 180, life: 0.6, size: 6)
        } else {
            audio.play("deal", volume: 0.5)
        }
        let held = trick
        let wait = holdSeconds
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            guard let self, self.trickHold == held else { return }
            self.endTrickHold()
        }
    }

    func endTrickHold() {
        guard trickHold != nil else { return }
        withAnimation(.spring(duration: 0.45, bounce: 0.1)) { trickHold = nil }
        audio.play("deal", pitch: 0.8, volume: 0.6)
        pump()
    }

    /// A tap during a held trick or the count-up skips it.
    func skip() -> Bool {
        if trickHold != nil {
            endTrickHold()
            return true
        }
        if view?.phase == .handScored && !revealDone {
            finishReveal()
            return true
        }
        return false
    }

    // MARK: - Phases

    private func onPhaseEnter(_ phase: Phase) {
        guard let v = view else { return }
        let L = layout
        switch phase {
        case .handScored:
            startReveal()
            if let r = v.result {
                if r.shooter == Seat.player {
                    audio.play("board_won")
                    burst(L.tableCX, L.trickCY, count: 70, colors: Theme.confetti, speed: 460, life: 1.6, size: 10)
                    shake(10)
                } else if r.shooter != nil {
                    audio.play("down")
                }
            }
        case .boardWon:
            audio.play("board_won")
            burst(L.tableCX, 240, count: 60, colors: Theme.confetti, speed: 420, life: 1.4, size: 9)
        case .gameOver:
            audio.play("game_over")
        case .victory:
            audio.play("board_won")
            for i in 0..<4 {
                burst(L.tableCX + Double(i - 2) * 200 + 100, 200, count: 50, colors: Theme.confetti, speed: 460, life: 1.8, size: 10)
            }
        default:
            break
        }
    }

    private func startReveal() {
        revealShown = 0
        revealDone = false
        Task { [weak self] in
            while let self, !self.revealDone, let r = self.view?.result {
                try? await Task.sleep(for: .seconds(self.revealSeconds))
                if self.revealDone { return }
                if self.revealShown < r.lines.count {
                    self.revealShown += 1
                    let line = r.lines[self.revealShown - 1]
                    if line.edition != nil {
                        self.audio.play("doubled", pitch: 1.1 + 0.03 * Float(self.revealShown))
                        self.shake(2)
                    } else if line.mult != nil || (line.xmult.map { $0 != 1 } ?? false) {
                        self.audio.play("mult", pitch: 1 + 0.04 * Float(self.revealShown))
                        self.shake(2.5)
                    } else {
                        self.audio.play("tick", pitch: 1 + 0.06 * Float(self.revealShown))
                    }
                } else {
                    self.completeReveal()
                }
            }
        }
    }

    private func completeReveal() {
        guard !revealDone, let r = view?.result else { return }
        revealShown = r.lines.count
        revealDone = true
        if r.total > 0 {
            audio.play("total")
            audio.play("made")
            let strength = min(14, 3 + log10(max(10, Double(r.total))) * 2.4)
            shake(strength)
            burst(layout.tableCX + 150, 420 + layout.dy, count: 18 + Int(strength * 2), colors: Theme.confetti, speed: 320, life: 1, size: 8)
        }
    }

    func finishReveal() { completeReveal() }

    func continueAfterHand() {
        guard view?.phase == .handScored, trickHold == nil else { return }
        if !revealDone { return finishReveal() }
        act(.continue)
    }

    // MARK: - The club

    func enterShop() {
        guard view?.phase == .boardWon else { return }
        audio.play("coin")
        act(.shop)
    }

    func buy(_ item: ShopItemV) {
        guard item.canBuy else { return }
        if item.needsCard {
            pickerSlot = item.slot
            audio.play("select")
            return
        }
        if act(.buy(slot: item.slot, card: nil))?.ok == true {
            audio.play("coin")
            shake(3)
            let x = layout.table.minX + 120 + Double(item.slot) * (layout.table.width - 60) / 4
            burst(x, 260, count: 30, colors: Theme.confetti, speed: 300, life: 0.9, size: 7)
        }
    }

    /// Apply the waiting seal or pack item to a card.
    func pick(_ cardId: Int) {
        guard let slot = pickerSlot else { return }
        if let why = engine.canApply(slot: slot, cardId: cardId) {
            showToast("Can't: \(why)", Theme.bad)
            audio.play("trick_lose", volume: 0.5)
            return
        }
        pickerSlot = nil
        if act(.buy(slot: slot, card: cardId))?.ok == true {
            audio.play("coin")
            shake(3)
        }
    }

    func sellRelic(_ index: Int) {
        act(.sellRelic(index))
        audio.play("sell")
    }

    func reroll() {
        guard let v = view, v.money >= v.rerollCost else { return }
        act(.reroll)
        audio.play("reroll")
    }

    func leaveShop() {
        act(.leave)
        audio.play("button")
    }

    // MARK: - Hand order

    /// Your hand in display order: suits spades, hearts, diamonds, clubs, each
    /// low to high, then any order you've set by dragging.
    func orderedHand() -> [CardV] {
        guard let v = view else { return [] }
        let base = v.hand.mine.sorted { a, b in
            a.suit != b.suit ? a.suit > b.suit : (a.rank != b.rank ? a.rank < b.rank : a.id < b.id)
        }
        guard !handOrder.isEmpty else { return base }
        let rank = Dictionary(uniqueKeysWithValues: handOrder.enumerated().map { ($1, $0) })
        return base.enumerated().sorted {
            (rank[$0.element.id] ?? handOrder.count + $0.offset) < (rank[$1.element.id] ?? handOrder.count + $1.offset)
        }.map(\.element)
    }

    func move(_ id: Int, toIndex index: Int) {
        var ids = orderedHand().map(\.id)
        guard let from = ids.firstIndex(of: id) else { return }
        ids.remove(at: from)
        ids.insert(id, at: max(0, min(ids.count, index)))
        handOrder = ids
        audio.play("card_play", volume: 0.5, jitter: 0.1)
    }

    // MARK: - Effects

    func showToast(_ text: String, _ color: Color) {
        let t = Toast(text: text, color: color)
        withAnimation(.spring(duration: 0.3, bounce: 0.4)) { toast = t }
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(2.6))
            guard let self, self.toast == t else { return }
            withAnimation(.easeOut(duration: 0.2)) { self.toast = nil }
        }
    }

    func shake(_ amount: Double) {
        shakeAmount = max(amount, Date() < shakeUntil ? shakeAmount : 0)
        shakeUntil = Date().addingTimeInterval(0.5)
    }

    func burst(_ x: Double, _ y: Double, count: Int, colors: [Color], speed: Double, life: Double, size: Double) {
        let now = Date()
        bursts.removeAll { now.timeIntervalSince($0.start) > $0.life * 1.3 }
        bursts.append(Burst(x: x, y: y, colors: colors, count: count, speed: speed, life: life, size: size,
                            start: now, seed: UInt64.random(in: 1...UInt64.max)))
    }

    func toMenu() { screen = .menu }
}

extension Comparable {
    func clamped(to r: ClosedRange<Self>) -> Self { min(max(self, r.lowerBound), r.upperBound) }
}
