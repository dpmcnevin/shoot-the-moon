import SwiftUI

/// Stage geometry. The stage is 1280 points wide, like the web game, and as
/// tall as the screen's aspect needs (720 at 16:9, 960 on a 4:3 iPad), so it
/// fills the screen with no bars. `dy` is how much taller than 720 it is.
struct TableLayout {
    static let cardW = 80.0
    static let cardH = 112.0

    let W: Double, H: Double
    let sidebar: CGRect
    let table: CGRect
    let tableCX: Double
    let trickCY: Double
    let ovalRX: Double, ovalRY: Double
    let handY: Double
    let maxHandWidth: Double
    /// Your hand is drawn larger than the other cards when there's room.
    let handScale: Double
    /// Cards in the trick are drawn larger too.
    let trickScale: Double
    let dy: Double

    struct SeatLayout { let x, y, dx, dy, r, s, labelX, labelY: Double }
    let seats: [Int: SeatLayout]
    let trickOffset: [Int: (Double, Double)]

    /// The stage for a screen of this size: 1280 points wide and as tall as
    /// the screen's shape (an iPad); or, on a screen wider than 16:9 (an
    /// iPhone), 720 tall and as wide as its shape, so there are no bars.
    static func fit(_ size: CGSize) -> TableLayout {
        guard size.width > 0, size.height > 0 else { return make(height: 720) }
        let aspect = size.width / size.height
        if 1280 / aspect >= 720 { return make(height: 1280 / aspect) }
        return make(width: min(1800, (720 * aspect).rounded()), height: 720)
    }

    static func make(width: Double = 1280, height: Double) -> TableLayout {
        let W = width, H = min(1000, max(720, height.rounded())), side = 270.0
        let extra = H - 720
        let cx = side + (W - side) / 2, cy = 290.0 + extra * 0.5
        let northY = 62 + extra * 0.18
        // 1.55x at 16:9, up to 1.8x on a 4:3 iPad; the extra height pays for it.
        let hs = 1.55 + min(0.25, extra / 960)
        let ts = 1.45 + min(0.2, extra / 1200)
        let handY = H - cardH * hs - 26 - min(14, extra / 16)
        let tv = 96 * ts / 1.45, th = 112 * ts
        return TableLayout(
            W: W, H: H,
            sidebar: CGRect(x: 0, y: 0, width: side, height: H),
            table: CGRect(x: side, y: 0, width: W - side, height: H),
            tableCX: cx, trickCY: cy, ovalRX: 300 + extra * 0.1, ovalRY: 190 + extra * 0.2,
            handY: handY, maxHandWidth: min(950, 600 * hs), handScale: hs, trickScale: ts, dy: extra / 2,
            seats: [
                Seat.north: SeatLayout(x: cx, y: northY, dx: 26, dy: 0, r: .pi, s: 0.62, labelX: cx, labelY: northY + 56),
                Seat.west: SeatLayout(x: side + 64, y: cy, dx: 0, dy: 20, r: .pi / 2, s: 0.62, labelX: side + 64, labelY: cy - 195),
                Seat.east: SeatLayout(x: W - 64, y: cy, dx: 0, dy: 20, r: -.pi / 2, s: 0.62, labelX: W - 64, labelY: cy - 195)
            ],
            trickOffset: [Seat.north: (0, -tv), Seat.south: (0, tv), Seat.west: (-th, 0), Seat.east: (th, 0)]
        )
    }

    func trickPoint(_ seat: Int) -> (Double, Double) {
        let o = trickOffset[seat] ?? (0, 0)
        return (tableCX + o.0, trickCY + o.1)
    }

    /// Where a seat's cards come from and go to.
    func origin(_ seat: Int) -> (Double, Double) {
        if seat == Seat.player { return (tableCX, H + Self.cardH) }
        let s = seats[seat]!
        return (s.x, s.y)
    }

    struct Slot { let x, w, cx, cy, r: Double }

    var handCardW: Double { Self.cardW * handScale }
    var handCardH: Double { Self.cardH * handScale }

    /// Your fanned hand. `x` and `w` are the strip of each card left showing.
    func handSlots(_ n: Int) -> [Slot] {
        let cw = handCardW
        let spacing = n > 1 ? min(56 * handScale, (maxHandWidth - cw) / Double(n - 1)) : 0
        let total = cw + spacing * Double(max(0, n - 1))
        let x0 = tableCX - total / 2
        return (0..<n).map { i in
            let k = Double(i + 1) - Double(n + 1) / 2
            return Slot(x: x0 + Double(i) * spacing, w: i == n - 1 ? cw : spacing,
                        cx: x0 + Double(i) * spacing + cw / 2,
                        cy: handY + handCardH / 2 + k * k * 0.5, r: k * 0.028)
        }
    }

    func opponentSlots(_ seat: Int, _ n: Int) -> [(x: Double, y: Double)] {
        let s = seats[seat]!
        return (0..<n).map { i in
            let k = Double(i) - Double(n - 1) / 2
            return (s.x + k * s.dx, s.y + k * s.dy)
        }
    }

    func isOverTrick(_ p: CGPoint) -> Bool {
        let dx = (p.x - tableCX) / ovalRX, dy = (p.y - trickCY) / ovalRY
        return dx * dx + dy * dy < 1
    }
}

/// A small fixed tilt per card, so tricks look tossed rather than placed.
func tossAngle(_ c: CardV) -> Double {
    let step: Int = (c.rank * 7 + c.suit * 13) % 11 - 5
    return Double(step) * 0.022
}
