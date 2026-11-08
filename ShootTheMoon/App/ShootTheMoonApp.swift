import SwiftUI

@main
struct ShootTheMoonApp: App {
    @State private var model: GameModel? = try? GameModel()

    var body: some Scene {
        WindowGroup {
            if let model {
                RootView()
                    .environment(model)
                    .preferredColorScheme(.dark)
                    .persistentSystemOverlays(.hidden)
                    .statusBarHidden()
                    .onAppear(perform: lockWindow)
            } else {
                Text("The game engine failed to load.").foregroundStyle(.white)
            }
        }
    }
}

/// The game is landscape only and full screen. Info.plist says so, but
/// resizable iPad windows can ignore it, so ask the scene directly as well:
/// landscape, and a window that can only be the size of the screen.
@MainActor
private func lockWindow() {
    for scene in UIApplication.shared.connectedScenes {
        guard let windowScene = scene as? UIWindowScene else { continue }
        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape)) { error in
            print("landscape request: \(error.localizedDescription)")
        }
        let b = windowScene.screen.bounds
        let size = CGSize(width: max(b.width, b.height), height: min(b.width, b.height))
        windowScene.sizeRestrictions?.minimumSize = size
        windowScene.sizeRestrictions?.maximumSize = size
    }
}

/// The 1280-point-wide stage, as tall as the screen's aspect, scaled to fit,
/// with the current screen, overlays, particles and screen shake.
struct RootView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        GeometryReader { geo in
            let _ = fit(geo.size)
            // Until the layout matches the screen's shape (the first frame
            // after launch), draw only the background rather than a
            // letterboxed stage.
            if geo.size.width > 0 && Self.wantedHeight(geo.size) != model.layout.H {
                Theme.bg
            } else {
            TimelineView(.animation(paused: Date() > model.shakeUntil)) { tl in
                let L = model.layout
                let scale = min(geo.size.width / L.W, geo.size.height / L.H)
                let shaking = tl.date < model.shakeUntil
                let k = shaking ? model.shakeAmount * model.shakeUntil.timeIntervalSince(tl.date) / 0.5 : 0
                stage
                    .frame(width: L.W, height: L.H)
                    .coordinateSpace(.named("stage"))
                    .offset(x: shaking ? Double.random(in: -k...k) : 0, y: shaking ? Double.random(in: -k...k) : 0)
                    .scaleEffect(scale)
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            }
        }
        .background(Theme.bg)
        .ignoresSafeArea()
    }

    /// Match the stage's height to the screen's aspect, so there are no bars.
    /// The stage height this screen size calls for (clamped as the layout is).
    static func wantedHeight(_ size: CGSize) -> Double {
        TableLayout.make(height: 1280 * size.height / size.width).H
    }

    private func fit(_ size: CGSize) {
        guard size.width > 0 else { return }
        let h = 1280 * size.height / size.width
        if Self.wantedHeight(size) != model.layout.H {
            DispatchQueue.main.async { model.layout = .make(height: h) }
        }
    }

    @ViewBuilder
    private var stage: some View {
        let L = model.layout
        ZStack(alignment: .topLeading) {
            if model.screen == .menu || model.view == nil {
                MenuView()
                if model.showHelp { HelpView() }
                if model.showCollection { CollectionView().frame(width: L.W, height: L.H) }
            } else if let v = model.view {
                Felt().frame(width: L.table.width, height: L.table.height).offset(x: L.table.minX)
                if v.phase == .shop {
                    ShopView().offset(x: L.table.minX)
                } else {
                    TableView()
                    Group {
                        switch v.phase {
                        case .handScored where model.trickHold == nil: ScorePanel().position(x: L.tableCX, y: 350 + L.dy)
                        case .boardWon: BoardWonPanel().position(x: L.tableCX, y: 330 + L.dy)
                        case .gameOver: EndingPanel(victory: false).position(x: L.tableCX, y: 340 + L.dy)
                        case .victory: EndingPanel(victory: true).position(x: L.tableCX, y: 340 + L.dy)
                        default: EmptyView()
                        }
                    }
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
                    .zIndex(120)
                }
                Sidebar().zIndex(100)
                if let info = model.inspect { InfoCardView(info: info).zIndex(290).transition(.opacity) }
                if model.pickerSlot != nil { CardPickerView().frame(width: L.W, height: L.H).zIndex(300) }
                if model.showOverview && v.phase != .gameOver && v.phase != .victory {
                    TableOverview().frame(width: L.W, height: L.H).zIndex(280)
                        .transition(.opacity)
                }
                GameButton("Menu", style: .plain, size: .small) { model.toMenu() }
                    .frame(width: 80).position(x: L.W - 50, y: 24).zIndex(110)
            }
            ToastView().zIndex(400)
            Particles().frame(width: L.W, height: L.H).zIndex(500)
        }
        .frame(width: L.W, height: L.H, alignment: .topLeading)
        .animation(.spring(duration: 0.32, bounce: 0.35), value: model.view?.phase)
        .animation(.spring(duration: 0.25), value: model.pickerSlot)
        .animation(.easeOut(duration: 0.2), value: model.showOverview)
    }
}
