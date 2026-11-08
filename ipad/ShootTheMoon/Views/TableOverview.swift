import SwiftUI

/// The table at a glance: its three boards with their goals, hands and
/// payouts, which are won, and the High Board's boss and its rule. Shown
/// before each board starts, and from the sidebar's progress.
struct TableOverview: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let L = model.layout
        let table = v.endless == true ? v.table : min(v.table, v.tables)
        let current = v.tableBoards.first { $0.board == v.board }
        let playLabel: String = {
            guard let b = current else { return "Back to the table" }
            if b.board == v.boardsPerTable, let boss = v.boss { return "Face \(boss.name)" }
            return v.handsLeft < v.handsPerBoard ? "Back to \(b.name)" : "Play \(b.name)"
        }()

        ZStack {
            Color.black.opacity(0.55)
            Panel(edge: v.boss?.active == true ? Theme.bad : Theme.brass) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(v.endless == true ? "Table \(table) · endless" : "Table \(table) of \(v.tables)").font(Theme.font(34, .bold)).foregroundStyle(Theme.brass).inkShadow(3)
                        Spacer()
                        HStack(spacing: 4) {
                            ForEach(1...v.tables, id: \.self) { t in
                                Rectangle().fill(t < table ? Theme.brass : t == table ? Theme.ink : Theme.panelEdge)
                                    .frame(width: 14, height: 14)
                            }
                        }
                    }
                    Text("Win all three boards to move on to the next table. Each board's goal must be reached before its hands run out.")
                        .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(alignment: .top, spacing: 14) {
                        ForEach(v.tableBoards) { b in
                            BoardColumn(v: v, board: b)
                        }
                    }
                    .frame(height: 360)

                    HStack {
                        Text("Money $\(num(Double(v.money)))").font(Theme.font(18)).foregroundStyle(Theme.brass)
                        Spacer()
                        GameButton(playLabel, pulse: true) { model.showOverview = false }
                            .frame(width: 260)
                    }
                }
                .padding(.horizontal, 28).padding(.vertical, 22)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 820)
            .position(x: L.W / 2 + L.sidebar.width / 2, y: L.H / 2)
        }
    }
}

private struct BoardColumn: View {
    @Environment(GameModel.self) private var model
    let v: GameView
    let board: TableBoardV

    var body: some View {
        let isBoss = board.board == v.boardsPerTable && v.boss != nil
        let won = board.board < v.board || (board.board == v.board && (v.phase == .boardWon || v.phase == .shop))
        let skipped = v.skipped?.contains(board.board) == true
        let now = board.board == v.board && !won
        let edge = isBoss ? Theme.bad : now ? Theme.brass : Theme.panelEdge

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(board.name).font(Theme.font(22, .bold))
                Spacer()
                Text(skipped ? "SKIPPED" : won ? "WON" : now ? "NOW" : "UP NEXT").font(Theme.font(12, .bold)).kerning(1)
                    .foregroundStyle(won ? Theme.good : now ? Theme.brass : Theme.inkFaint)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("Goal").font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                Text(num(Double(board.target))).font(Theme.font(34, .bold)).monospacedDigit().inkShadow()
            }
            HStack {
                Text("\(board.hands) hands").font(Theme.font(15)).foregroundStyle(board.hands < 3 ? Theme.bad : Theme.inkDim)
                Spacer()
                Text("Pays $\(board.reward)+").font(Theme.font(15)).foregroundStyle(Theme.brass)
            }
            if isBoss, let boss = v.boss {
                Rectangle().fill(Theme.panelEdge).frame(height: 2)
                Text("BOSS").font(Theme.font(12, .bold)).kerning(1).foregroundStyle(Theme.bad)
                Text(boss.name).font(Theme.font(20, .bold)).foregroundStyle(Theme.ink)
                Text(boss.text).font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Spacer(minLength: 0)
                Text(skipped ? "Skipped for its tag." : won ? "Done." : now ? "You're here." : "Standard rules.")
                    .font(Theme.font(14)).foregroundStyle(Theme.inkFaint)
            }
            if let tag = board.tag, !won, !skipped {
                Rectangle().fill(Theme.panelEdge).frame(height: 2)
                HStack(spacing: 6) {
                    Icon(key: tag.icon)
                    Text("Skip for \(Text(tag.name).bold())").font(Theme.font(14)).foregroundStyle(Theme.ploy)
                }
                Text(tag.text + ".").font(Theme.font(13)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                if now, v.skipTag != nil {
                    GameButton("Skip \(board.name)", style: .ploy, size: .small) { model.skipBoard() }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(PixelRect(radius: 10).fill(won ? Theme.bg : Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(PixelRect(radius: 10).stroke(edge, lineWidth: now || isBoss ? 3 : 2))
        .opacity(won ? 0.7 : 1)
    }
}
