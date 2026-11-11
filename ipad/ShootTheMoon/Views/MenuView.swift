import SwiftUI

/// The main menu: a fan of four random cards, some with an edition
/// (draggable, tap to flip), the title, a seed box and settings.
struct MenuView: View {
    @Environment(GameModel.self) private var model
    @State private var moved: [Int: CGPoint] = [:]
    @State private var faceDown: Set<Int> = []
    @State private var dealt = false

    /// The repo commit this build was made from (written by the pre-build step).
    static let engineVersion: String = Bundle.main.url(forResource: "engine-version", withExtension: "txt")
        .flatMap { try? String(contentsOf: $0, encoding: .utf8) }?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? "unknown"

    /// Dealt fresh each time the menu appears.
    @State private var fan = MenuView.dealFan()

    struct FanCard: Identifiable {
        let card: CardV
        let edition: String?
        var id: Int { card.id }
    }

    /// Four different cards, each with about a one-in-three chance of an
    /// edition (weighted like the club's: Etched most often, Phantom rarely).
    static func dealFan() -> [FanCard] {
        let ranks = Array("23456789TJQKA"), suits = Array("CDHS"), symbols = ["♣", "♦", "♥", "♠"]
        var deck = (1...4).flatMap { s in (2...14).map { r in (s, r) } }.shuffled()
        return (0..<4).map { i in
            let (s, r) = deck.removeFirst()
            let label = r <= 10 ? String(r) : String(ranks[r - 2])
            let card = CardV(id: -(i + 1), suit: s, rank: r, code: "\(ranks[r - 2])\(suits[s - 1])", name: label + symbols[s - 1], seal: nil)
            var edition: String?
            if Double.random(in: 0..<1) < 0.33 {
                let roll = Double.random(in: 0..<1)
                edition = roll < 0.4 ? "etched" : roll < 0.7 ? "lacquered" : roll < 0.9 ? "prismatic" : "phantom"
            }
            return FanCard(card: card, edition: edition)
        }
    }

    /// Show the new deck's back: the end card of the fan turns over.
    private func showBack() {
        if let last = fan.last { faceDown.insert(last.id) }
    }

    var body: some View {
        let L = model.layout
        @Bindable var model = model
        ZStack {
            Felt()
            ForEach(Array(fan.enumerated()), id: \.element.id) { i, f in
                let c = f.card
                let k = Double(i + 1) - 2.5
                let home = CGPoint(x: L.W / 2 + k * (L.dy < 20 ? 60 : 70), y: (L.dy < 20 ? 92 : 108) + L.dy * 0.7 + k * k * 6)
                let at = moved[c.id] ?? home
                CardView(card: c, faceUp: dealt && !faceDown.contains(c.id), lift: 6)
                    .modifier(EditionShine(edition: faceDown.contains(c.id) ? nil : f.edition))
                    .overlay(alignment: .bottom) {
                        if let e = f.edition, !faceDown.contains(c.id) {
                            Text(e.uppercased()).font(Theme.font(10, .bold)).kerning(1)
                                .foregroundStyle(Edition.color(e))
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(PixelRect(radius: 2).fill(Theme.sidebar.opacity(0.9)))
                                .offset(y: 12)
                        }
                    }
                    // Smaller on a short stage (an iPhone), so the fan clears the title.
                    .scaleEffect(L.dy < 20 ? 0.9 : 1.1)
                    .rotationEffect(.radians(moved[c.id] == nil ? k * 0.16 : 0))
                    .position(dealt ? at : CGPoint(x: L.W / 2, y: -150))
                    .animation(.spring(duration: 0.6, bounce: 0.25).delay(dealt ? 0.15 + Double(i) * 0.09 : 0), value: dealt)
                    .animation(.spring(duration: 0.35, bounce: 0.2), value: moved[c.id])
                    .animation(.spring(duration: 0.5), value: faceDown)
                    .gesture(DragGesture(coordinateSpace: .named("stage"))
                        .onChanged { g in moved[c.id] = g.location }
                        .onEnded { _ in model.audio.play("card_play", jitter: 0.1) })
                    .onTapGesture {
                        if faceDown.contains(c.id) { faceDown.remove(c.id) } else { faceDown.insert(c.id) }
                        model.audio.play("flip", volume: 0.7, jitter: 0.08)
                    }
            }
            VStack(spacing: 12) {
                Text("SHOOT THE MOON").font(Theme.font(64, .heavy)).kerning(2).foregroundStyle(Theme.brass).inkShadow(6)
                Text("a hearts roguelike").font(Theme.font(20)).foregroundStyle(Theme.inkDim).padding(.bottom, 10)
                if model.hasLiveRun {
                    GameButton("Continue run", size: .large, pulse: true) { model.continueRun() }.frame(width: 260)
                }
                GameButton("New run", size: .large, pulse: !model.hasLiveRun) { model.newRun() }.frame(width: 260)
                TextField("Seed (optional)", text: $model.seedInput)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(Theme.font(17))
                    .padding(.horizontal, 14)
                    .frame(width: 260, height: 40)
                    .background(PixelRect(radius: 6).fill(Theme.feltEdge))
                    .overlay(PixelRect(radius: 6).stroke(Theme.panelEdge, lineWidth: 2))
                    .foregroundStyle(Theme.ink)
                if let decks = model.catalog?.decks, !decks.isEmpty {
                    let i = decks.firstIndex(where: { $0.key == model.deck }) ?? 0
                    VStack(spacing: 2) {
                        HStack(spacing: 6) {
                            GameButton("", style: .plain, size: .small, sound: "select") { model.deck = decks[(i + decks.count - 1) % decks.count].key; showBack() }
                                .frame(width: 40)
                                .overlay { Arrow(left: true).fill(Theme.ink).frame(width: 10, height: 14).allowsHitTesting(false) }
                            Text(decks[i].name).font(Theme.font(17)).foregroundStyle(Theme.brass).frame(maxWidth: .infinity)
                            GameButton("", style: .plain, size: .small, sound: "select") { model.deck = decks[(i + 1) % decks.count].key; showBack() }
                                .frame(width: 40)
                                .overlay { Arrow(left: false).fill(Theme.ink).frame(width: 10, height: 14).allowsHitTesting(false) }
                        }
                        .frame(width: 260)
                        Text(decks[i].text).font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                    }
                }
                HStack(spacing: 8) {
                    GameButton("How to play", style: .plain) { model.showHelp = true }
                    GameButton("Collection", style: .plain) { model.showCollection = true }
                }
                .frame(width: 330)
                HStack(spacing: 6) {
                    GameButton(model.music ? "Music on" : "Music off", style: .plain, size: .small) { model.music.toggle() }
                    GameButton(model.sfx ? "Sound on" : "Sound off", style: .plain, size: .small) { model.sfx.toggle() }
                    GameButton(model.fourColor ? "4 colors" : "2 colors", style: .plain, size: .small) { model.fourColor.toggle() }
                }
                .frame(width: 330)
                .padding(.top, 10)
                SpeedSlider(width: 330)
            }
            .position(x: L.W / 2, y: 430 + L.dy * 1.2)
            if !moved.isEmpty || !faceDown.isEmpty {
                GameButton("Tidy the cards", style: .plain, size: .small, sound: "reroll") { moved = [:]; faceDown = [] }
                    .frame(width: 150).position(x: L.W - 100, y: L.H - 36)
            }
            Text("v\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") · \(MenuView.engineVersion)")
                .font(Theme.font(14)).foregroundStyle(Theme.inkDim.opacity(0.8))
                .frame(width: 320, alignment: .leading).position(x: 180, y: L.H - 24)
        }
        .onAppear {
            dealt = true
            Task { try? await Task.sleep(for: .seconds(0.25)); model.audio.play("deal", jitter: 0.1) }
        }
    }
}

struct HelpView: View {
    @Environment(GameModel.self) private var model
    private let paragraphs = [
        "Hearts, against three opponents. Every heart you take costs a point, and the queen of spades costs thirteen. Take every point, though, and you shoot the moon.",
        "Each hand starts with a pass: pick three cards to give away (left, right, across, then a hand with no passing). The lowest club leads, and you must follow suit if you can. Hearts can only be led once they're broken: by a heart being played, or by someone taking the queen.",
        "Each hand scores chips x mult. Your chips are 26 less the points you took, plus a bonus for a clean hand. Shooting the moon pays three times the points in the pack, scores your Dodge and Clean Sheet levels too, and doubles the mult.",
        "Reach each board's target within three hands. Win boards to earn money, then spend it at the club on relics, upgrades, seals that mark a card for the rest of the run, and pack items that change the cards everyone is dealt.",
        "Some relics pay you to take hearts or the queen, so a run can go hunting instead of hiding. Beat all three boards at each of eight tables to win.",
        "Each table's High Board has a boss: a house rule that bends Hearts for that board, from a doubled queen to opponents who gang up on you. You see the boss when the table starts; tap the table progress in the sidebar to look again."
    ]

    var body: some View {
        ZStack {
            Color.black.opacity(0.55).onTapGesture { model.showHelp = false }
            Panel {
                VStack(alignment: .leading, spacing: 12) {
                    Text("How to play").font(Theme.font(28, .bold)).foregroundStyle(Theme.brass).inkShadow()
                    ForEach(paragraphs, id: \.self) { Text($0).font(Theme.font(17)) }
                    Text("Tap cards to pick or play them; drag to rearrange your hand, or onto the table to play.")
                        .font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                    HStack { Spacer(); GameButton("Got it") { model.showHelp = false }.frame(width: 150) }
                }
                .padding(.horizontal, 30).padding(.vertical, 20)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 760)
        }
    }
}

/// A drawn arrowhead: the ◀ ▶ characters turn into emoji on iOS.
struct Arrow: Shape {
    let left: Bool
    func path(in r: CGRect) -> Path {
        Path { p in
            if left {
                p.move(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
            } else {
                p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY)); p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
            }
            p.closeSubpath()
        }
    }
}
