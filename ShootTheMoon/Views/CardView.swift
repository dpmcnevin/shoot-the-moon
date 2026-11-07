import SwiftUI

/// One card: the pixel-art face or back, flipping around its vertical axis.
/// The flip angle is animatable, so a change of `faceUp` springs through the
/// edge-on frame and swaps faces halfway, like the web game's flip.
struct CardView: View {
    @Environment(GameModel.self) private var model
    let card: CardV?
    var faceUp: Bool
    var highlight: Color? = nil
    var dim = false
    var lift = 0.0

    var body: some View {
        Color.clear
            .frame(width: TableLayout.cardW, height: TableLayout.cardH)
            .modifier(FlipModifier(angle: faceUp ? 0 : 180, front: front, back: back))
            .shadow(color: .black.opacity(0.32 - min(0.12, lift * 0.004)), radius: 0,
                    x: (3 + lift * 0.35) * 0.6, y: 3 + lift * 0.35)
    }

    private var front: AnyView {
        AnyView(
            ZStack(alignment: .topLeading) {
                PixelImage(image: card.flatMap { model.art.card($0, fourColor: model.fourColor) })
                if let seal = card?.seal {
                    PixelImage(image: model.art.seal(seal)).frame(width: 28, height: 28).offset(x: 1, y: 34)
                }
                if dim { RoundedRectangle(cornerRadius: 4).fill(Color(red: 0.06, green: 0.1, blue: 0.09).opacity(0.5)) }
                if let highlight {
                    RoundedRectangle(cornerRadius: 6).stroke(highlight, lineWidth: 3).padding(-3)
                }
            }
        )
    }

    private var back: AnyView { AnyView(PixelImage(image: model.art.back())) }
}

struct FlipModifier: ViewModifier, Animatable {
    var angle: Double
    let front: AnyView
    let back: AnyView

    nonisolated var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    func body(content: Content) -> some View {
        content
            .overlay { angle < 90 ? front : AnyView(back.scaleEffect(x: -1, y: 1)) }
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.4)
    }
}
