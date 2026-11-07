import SwiftUI

/// The main menu: a fan of the cards that matter (draggable, tap to flip),
/// the title, a seed box and settings.
struct MenuView: View {
    @Environment(GameModel.self) private var model
    @State private var moved: [Int: CGPoint] = [:]
    @State private var faceDown: Set<Int> = []
    @State private var dealt = false

    private let fan: [CardV] = [
        CardV(id: -1, suit: 3, rank: 14, code: "AH", name: "A♥", seal: nil),
        CardV(id: -2, suit: 4, rank: 12, code: "QS", name: "Q♠", seal: nil),
        CardV(id: -3, suit: 3, rank: 13, code: "KH", name: "K♥", seal: nil),
        CardV(id: -4, suit: 2, rank: 11, code: "JD", name: "J♦", seal: nil)
    ]

    var body: some View {
        let L = model.layout
        @Bindable var model = model
        ZStack {
            Felt()
            ForEach(Array(fan.enumerated()), id: \.element.id) { i, c in
                let k = Double(i + 1) - 2.5
                let home = CGPoint(x: L.W / 2 + k * 70, y: 120 + L.dy * 0.6 + k * k * 6)
                let at = moved[c.id] ?? home
                CardView(card: c, faceUp: dealt && !faceDown.contains(c.id), lift: 6)
                    .scaleEffect(1.1)
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
                    .background(RoundedRectangle(cornerRadius: 6).fill(Theme.feltEdge))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.panelEdge, lineWidth: 2))
                    .foregroundStyle(Theme.ink)
                GameButton("How to play", style: .plain) { model.showHelp = true }.frame(width: 260)
                HStack(spacing: 6) {
                    GameButton(model.music ? "Music on" : "Music off", style: .plain, size: .small) { model.music.toggle() }
                    GameButton(model.sfx ? "Sound on" : "Sound off", style: .plain, size: .small) { model.sfx.toggle() }
                    GameButton(model.fourColor ? "4 colors" : "2 colors", style: .plain, size: .small) { model.fourColor.toggle() }
                }
                .frame(width: 330)
                .padding(.top, 10)
            }
            .position(x: L.W / 2, y: 430 + L.dy * 1.2)
            if !moved.isEmpty || !faceDown.isEmpty {
                GameButton("Tidy the cards", style: .plain, size: .small, sound: "reroll") { moved = [:]; faceDown = [] }
                    .frame(width: 150).position(x: L.W - 100, y: L.H - 36)
            }
            Text("v\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                .font(Theme.font(14)).foregroundStyle(Theme.inkDim.opacity(0.8))
                .position(x: 50, y: L.H - 24)
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
        "Each hand scores chips x mult. Your chips are 26 less the points you took, plus a bonus for a clean hand. Shooting the moon pays three times the points in the pack.",
        "Reach each board's target within three hands. Win boards to earn money, then spend it at the club on relics, upgrades, seals that mark a card for the rest of the run, and pack items that change the cards everyone is dealt.",
        "Some relics pay you to take hearts or the queen, so a run can go hunting instead of hiding. Beat all three boards at each of eight tables to win."
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
