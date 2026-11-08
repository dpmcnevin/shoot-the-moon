import Foundation
import SwiftUI

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
    /// A card edition on it (ruleset v4): etched, lacquered or prismatic.
    var edition: String? = nil

    var isHeart: Bool { suit == 3 }
    /// The king of hearts, for showing what a card edition looks like.
    static let sample = CardV(id: 0, suit: 3, rank: 13, code: "KH", name: "K♥", seal: nil)
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
    /// The seat holding every point taken so far (a moon still in reach).
    let moonOnCourse: Int?
    let received: [Int]
    let receivedFrom: Int?
    /// Suits each opponent has shown they're out of, by seat (Card Counter).
    let voids: [String: [Int]]?
    /// Cards played so far this hand (the Glass Deck crosses them off).
    let played: [Int]?

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
    /// For beating a boss.
    let boss: Int?
    /// For beating the goal by a margin (ruleset v3).
    let overshoot: Int?
    let total: Int
}

/// This table's boss: a house rule for its High Board.
struct BossV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
    /// It's the boss's board now.
    let active: Bool
    let sharkSeat: Int
}

/// One board of the current table, for the table overview.
struct TableBoardV: Decodable, Identifiable {
    let board: Int
    let name: String
    let target: Int
    let reward: Int
    let hands: Int
    var id: Int { board }
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
    /// For a card edition offer (ruleset v4).
    let cardEdition: String?
    var id: Int { slot }
    var needsCard: Bool { kind == "seal" || kind == "pack" || kind == "edition" }
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

/// A ploy you hold (ruleset v5).
struct PloyV: Decodable, Identifiable {
    let slot: Int
    let key: String
    let name: String
    let text: String
    let icon: String
    let canUse: Bool
    let why: String?
    var id: Int { slot }
}

/// An opened bundle: its three choices.
struct OpeningV: Decodable {
    struct Choice: Decodable {
        let kind: String
        let name: String
        let text: String
        let icon: String?
        let rarity: Int?
        let rarityName: String?
        let edition: EditionV?
        let card: CardV?
        let cardEdition: String?
    }
    let bundle: String
    let name: String
    let options: [Choice]
}

/// An edition on a card in your pack (ruleset v4).
struct CardEditionV: Decodable, Identifiable {
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
    let boss: BossV?
    let jinxed: String?
    let tableBoards: [TableBoardV]
    let levels: [LevelV]
    let relics: [RelicV]
    let seals: [SealV]
    let cardEditions: [CardEditionV]?
    /// Ploys (ruleset v5) and what they're doing this hand.
    let ploysOn: Bool?
    let ploys: [PloyV]?
    let ploySlots: Int?
    let spotlight: Bool?
    let spying: Bool?
    let spyHands: [String: [CardV]]?
    let umbrella: Bool?
    let fallGuy: Bool?
    /// A bundle being opened in the club.
    let opening: OpeningV?
    let pack: [CardV]
    /// Whether the deck may be looked at now (see DeckView).
    let canSeeDeck: Bool?
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

extension GameView {
    /// The boss whose rule is in force right now, if any.
    func bossNow(_ key: String) -> Bool { boss?.active == true && boss?.key == key }
}

// MARK: - Collection

struct CatalogV: Decodable {
    struct Relic: Decodable, Identifiable { let key, name, text: String; let rarity: Int; let rarityName: String; let cost: Int; let icon: String; var id: String { key } }
    struct Edition: Decodable, Identifiable { let key, name, text: String; let cost: Int; var id: String { key } }
    struct Seal: Decodable, Identifiable { let key, name, text: String; let cost: Int; let color: String; var id: String { key } }
    struct PackItem: Decodable, Identifiable { let key, name, text: String; let cost: Int; let icon: String; var id: String { key } }
    struct Upgrade: Decodable, Identifiable { let key, name, text, icon: String; let chips, mult: Double; var id: String { key } }
    struct Boss: Decodable, Identifiable { let key, name, text: String; let tier: Int; var id: String { key } }
    let relics: [Relic]
    let editions: [Edition]
    let seals: [Seal]
    let cardEditions: [Edition]?
    let ploys: [PackItem]?
    let bundles: [PackItem]?
    let packItems: [PackItem]
    let upgrades: [Upgrade]
    let bosses: [Boss]
}

/// What the sidebar's info card shows for a tapped relic, seal or upgrade.
struct InfoCard: Equatable {
    var kind: String
    var title: String
    var text: String
    var note: String? = nil
    var color: Color
    /// Where the tap was, on the stage, so the card sits beside it.
    var y: Double
    /// A held ploy: the card offers to use it.
    var ploySlot: Int? = nil
}

extension HandV {
    /// Show the moon chip once enough points are in one pile to matter.
    func moonChip(for seat: Int) -> Bool {
        moonOnCourse == seat && points[seat] >= 4
    }
}

// MARK: - Profile

/// The player's record across runs (engine profile.ts), for the Stats tab.
struct ProfileV: Decodable {
    struct Run: Decodable, Identifiable {
        let id: String
        let seed: String
        let started: Double
        let result: String
        let table: Int
        let board: Int
        let bestHand: Int
        let moons: Int
        let relics: [String]
    }
    var runs = 0, wins = 0, bestTable = 0, bestHand = 0, moons = 0, cleanHands = 0, handsPlayed = 0
    var relicsFound: [String] = []
    var bossesBeaten: [String] = []
    var history: [Run] = []

    static func load(_ json: String?) -> ProfileV {
        guard let json, let p = try? JSONDecoder().decode(ProfileV.self, from: Data(json.utf8)) else { return ProfileV() }
        return p
    }
}
