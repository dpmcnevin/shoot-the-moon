import Foundation

// Snapshots the bridge returns (see ios/bridge/entry.ts `view()`).

enum Phase: String, Decodable {
    case pass, play
    case handScored = "hand_scored"
    case boardWon = "board_won"
    case shop
    case gameOver = "game_over"
    case victory
}

struct CardV: Decodable, Hashable, Identifiable {
    let id: Int
    let suit: Int
    let rank: Int
    let code: String
    let name: String
    let seal: String?

    var isHeart: Bool { suit == 3 }
    var isQueenOfSpades: Bool { suit == 4 && rank == 12 }
}

struct PlayV: Decodable, Hashable {
    let seat: Int
    let card: CardV
}

struct TrickV: Decodable, Hashable {
    let index: Int
    let winner: Int
    let points: Int
    let plays: [PlayV]
    let kitty: [CardV]
}

struct HandV: Decodable {
    let passDir: String
    let passTo: String?
    let mine: [CardV]
    let opponents: [String: [Int]]
    let kitty: [Int]
    let trick: [PlayV]
    let tricksPlayed: Int
    /// The last finished trick of this hand.
    let lastTrick: TrickV?
    let handSize: Int
    let turn: Int?
    let isPlayerTurn: Bool
    let legal: [Int]
    let points: [Int]
    let heartsBroken: Bool
    let received: [Int]
    let receivedFrom: Int?

    func opponentCards(_ seat: Int) -> [Int] { opponents[String(seat)] ?? [] }
}

struct LineV: Decodable, Hashable {
    let label: String
    let chips: Double?
    let mult: Double?
    let xmult: Double?
    let money: Int?
    /// Set on a relic edition's bonus line.
    let edition: String?
}

/// A relic's edition: Etched, Lacquered, Prismatic or Phantom.
struct EditionV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
}

struct ResultV: Decodable {
    let lines: [LineV]
    let chips: Double
    let mult: Double
    let total: Int
    let myPoints: Int
    let shooter: Int?
    let points: [Int]
    let money: Int
}

struct PayoutV: Decodable {
    let board: Int
    let unused: Int
    let interest: Int
    let relics: Int
    let total: Int
}

struct ShopItemV: Decodable, Identifiable {
    let slot: Int
    let kind: String
    let name: String
    let cost: Int
    let sold: Bool
    let canBuy: Bool
    let why: String?
    let text: String
    let icon: String?
    let rarity: Int?
    let rarityName: String?
    let edition: EditionV?
    let level: Int?
    let nextChips: Double?
    let nextMult: Double?
    let seal: String?
    let color: String?
    let op: String?
    var id: Int { slot }
    var needsCard: Bool { kind == "seal" || kind == "pack" }
}

struct LevelV: Decodable, Identifiable {
    let key: String
    let name: String
    let text: String
    let icon: String
    let level: Int
    let chips: Double
    let mult: Double
    var id: String { key }
}

struct RelicV: Decodable, Identifiable {
    let key: String
    let name: String
    let rarity: Int
    let rarityName: String
    let icon: String
    let text: String
    let sell: Int
    let edition: EditionV?
    var id: String { key }
}

struct SealV: Decodable, Identifiable {
    let cardId: Int
    let key: String
    let name: String
    let text: String
    let card: CardV?
    var id: Int { cardId }
}

struct StatsV: Decodable {
    let handsPlayed: Int
    let moons: Int
    let cleanHands: Int
    let bestHand: Int
    let totalScore: Int
    let pointsTaken: Int
}

struct GameView: Decodable {
    let hasRun: Bool
    let seed: String
    let phase: Phase
    let table: Int
    let tables: Int
    let board: Int
    let boardName: String
    let boardsPerTable: Int
    let target: Int
    let score: Int
    let handsLeft: Int
    let handsPerBoard: Int
    let money: Int
    let interest: Int
    let rerollCost: Int
    let relicSlots: Int
    let relicSlotsUsed: Int
    let levels: [LevelV]
    let relics: [RelicV]
    let seals: [SealV]
    let pack: [CardV]
    let packPoints: Int
    let hand: HandV
    let result: ResultV?
    let payout: PayoutV?
    let shop: [ShopItemV]?
    let stats: StatsV
    let seatNames: [String: String]

    func seatName(_ seat: Int) -> String { seatNames[String(seat)] ?? "?" }
}

struct StepV: Decodable {
    let seat: Int
    let card: CardV
}

struct ActResult: Decodable {
    let ok: Bool
    let trick: TrickV?
    let step: StepV?
    let brokeHearts: Bool
    let view: GameView
}

enum Seat {
    static let north = 1, east = 2, south = 3, west = 4
    static let player = south
}
