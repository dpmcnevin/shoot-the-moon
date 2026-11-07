import SwiftUI

/// The game's chunky button: a drop shadow, a lighter top lip, a gentle bob
/// when it's the obvious next step, and a click.
struct GameButton: View {
    @Environment(GameModel.self) private var model
    enum Style { case brass, plain, ploy }
    enum Size { case small, medium, large }

    let title: String
    var style: Style = .brass
    var size: Size = .medium
    var enabled = true
    var pulse = false
    var sound: String? = "button"
    let action: () -> Void

    init(_ title: String, style: Style = .brass, size: Size = .medium, enabled: Bool = true, pulse: Bool = false,
         sound: String? = "button", action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.size = size
        self.enabled = enabled
        self.pulse = pulse
        self.sound = sound
        self.action = action
    }

    var body: some View {
        Button {
            guard enabled else { return }
            if let sound { model.audio.play(sound, jitter: 0.03) }
            action()
        } label: {
            Text(title)
                .font(Theme.font(size == .small ? 15 : size == .large ? 21 : 20, .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(enabled ? (style == .brass ? Theme.bg : Theme.ink) : Theme.inkFaint)
                .frame(maxWidth: .infinity)
                .frame(height: size == .small ? 34 : size == .large ? 48 : 44)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(enabled ? fill : Theme.panelEdge)
                        .overlay(alignment: .top) {
                            if enabled { RoundedRectangle(cornerRadius: 2).fill(.white.opacity(0.18)).frame(height: 3).padding(.horizontal, 3).padding(.top, 2) }
                        }
                        .shadow(color: .black.opacity(0.35), radius: 0, x: 2, y: 5)
                )
        }
        .buttonStyle(PressStyle())
        .phaseAnimator([1.5, -1.5]) { content, y in
            content.offset(y: pulse && enabled ? y : 0)
        } animation: { _ in .easeInOut(duration: 0.78) }
    }

    private var fill: Color {
        switch style {
        case .brass: Theme.brass
        case .plain: Theme.panelEdge
        case .ploy: Theme.ploy
        }
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.offset(y: configuration.isPressed ? 3 : 0).brightness(configuration.isPressed ? -0.05 : 0)
    }
}

/// A rounded panel over the table.
struct Panel<Content: View>: View {
    var edge: Color = Theme.brassDim
    @ViewBuilder let content: Content

    var body: some View {
        content
            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 4, y: 6))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(edge, lineWidth: 2))
    }
}

/// A relic or upgrade icon, or a seal, in pixel art.
struct Icon: View {
    @Environment(GameModel.self) private var model
    let key: String
    var scale = 2.0
    var body: some View {
        PixelImage(image: model.art.icon(key)).frame(width: 18 * scale, height: 18 * scale)
    }
}

struct SealBadge: View {
    @Environment(GameModel.self) private var model
    let key: String
    var size = 28.0
    var body: some View {
        PixelImage(image: model.art.seal(key)).frame(width: size, height: size)
            .shadow(color: .black.opacity(0.35), radius: 0, x: 1, y: 2)
    }
}

/// Green baize with a slow art deco sunburst rising from below the table.
struct Felt: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 15)) { tl in
            Canvas { g, size in
                g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Theme.felt))
                let t = tl.date.timeIntervalSinceReferenceDate
                let sway = sin(t * 0.15) * 0.04
                let c = CGPoint(x: size.width / 2, y: size.height + 120)
                for i in stride(from: 0, to: 36, by: 2) {
                    let a0 = .pi + Double(i) / 36 * .pi + sway, a1 = .pi + Double(i + 1) / 36 * .pi + sway
                    var p = Path()
                    p.move(to: c)
                    p.addLine(to: CGPoint(x: c.x + cos(a0) * 1600, y: c.y + sin(a0) * 1600))
                    p.addLine(to: CGPoint(x: c.x + cos(a1) * 1600, y: c.y + sin(a1) * 1600))
                    p.closeSubpath()
                    g.fill(p, with: .color(Theme.feltLight.opacity(0.35)))
                }
            }
        }
    }
}

/// Confetti, computed from each burst's start time (no per-frame state).
struct Particles: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        TimelineView(.animation) { tl in
            Canvas { g, _ in
                let now = tl.date
                for b in model.bursts {
                    let age = now.timeIntervalSince(b.start)
                    guard age < b.life * 1.3 else { continue }
                    var rng = SplitMix(seed: b.seed)
                    for _ in 0..<b.count {
                        let a = rng.next() * .pi * 2
                        let v = b.speed * (0.35 + rng.next() * 0.65)
                        let life = b.life * (0.6 + rng.next() * 0.6)
                        let size = b.size * (0.6 + rng.next() * 0.8)
                        let spin = (rng.next() * 2 - 1) * 10
                        let color = b.colors[Int(rng.next() * Double(b.colors.count)) % b.colors.count]
                        guard age < life else { continue }
                        let drag = exp(-1.5 * age)
                        let x = b.x + cos(a) * v * (1 - drag) / 1.5
                        let y = b.y + (sin(a) * v - 120) * (1 - drag) / 1.5 + 0.5 * 520 * age * age
                        var ctx = g
                        ctx.opacity = 1 - age / life
                        ctx.translateBy(x: x, y: y)
                        ctx.rotate(by: .radians(spin * age))
                        ctx.fill(Path(CGRect(x: -size / 2, y: -size / 4, width: size, height: size / 2)), with: .color(color))
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

struct SplitMix {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> Double {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        z ^= z >> 31
        return Double(z >> 11) / Double(1 << 53)
    }
}

/// A short message that pops in over the table.
struct ToastView: View {
    @Environment(GameModel.self) private var model
    var body: some View {
        if let t = model.toast {
            Text(t.text)
                .font(Theme.font(20))
                .foregroundStyle(t.color)
                .padding(.horizontal, 20).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 8).fill(Theme.sidebar).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 4))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(t.color, lineWidth: 2))
                .transition(.scale(scale: 0.6).combined(with: .opacity))
                .id(t.id)
                .position(x: model.layout.tableCX, y: 470 + model.layout.dy)
                .allowsHitTesting(false)
        }
    }
}
