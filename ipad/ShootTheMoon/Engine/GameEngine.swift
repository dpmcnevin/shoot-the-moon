import Foundation
import JavaScriptCore

/// Hosts the bundled `game-bundle.js` (the web game's engine, unmodified,
/// plus the thin bridge in ios/bridge/entry.ts) in a JSContext and exposes
/// it as a Swift API. The run lives in JavaScript; Swift sends actions and
/// draws the snapshot it gets back.
@MainActor
final class GameEngine {
    private let context: JSContext
    private let api: JSValue
    private let decoder = JSONDecoder()

    enum EngineError: Error {
        case bundleNotFound
        case javascript(String)
    }

    init() throws {
        guard let context = JSContext() else { throw EngineError.javascript("no JSContext") }
        self.context = context
        context.exceptionHandler = { _, exception in
            print("[engine] JS exception: \(exception?.toString() ?? "?")")
        }
        let log: @convention(block) (String) -> Void = { print("[js] \($0)") }
        let console = JSValue(newObjectIn: context)
        console?.setObject(log, forKeyedSubscript: "log" as NSString)
        console?.setObject(log, forKeyedSubscript: "warn" as NSString)
        console?.setObject(log, forKeyedSubscript: "error" as NSString)
        context.setObject(console, forKeyedSubscript: "console" as NSString)

        guard let url = Bundle.main.url(forResource: "game-bundle", withExtension: "js") else {
            throw EngineError.bundleNotFound
        }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
        if let e = context.exception { throw EngineError.javascript(e.toString() ?? "load failed") }
        guard let api = context.objectForKeyedSubscript("ShootTheMoon"), !api.isUndefined else {
            throw EngineError.javascript("ShootTheMoon global missing")
        }
        self.api = api
    }

    /// Call a bridge function that returns a JSON string.
    private func call(_ name: String, _ args: [Any] = []) throws -> String {
        context.exception = nil
        let result = api.invokeMethod(name, withArguments: args)
        if let e = context.exception {
            context.exception = nil
            throw EngineError.javascript(e.toString() ?? "\(name) failed")
        }
        return result?.toString() ?? ""
    }

    private func decode<T: Decodable>(_ json: String) throws -> T {
        try decoder.decode(T.self, from: Data(json.utf8))
    }

    func newRun(seed: String?, deck: String = "standard") throws -> GameView {
        try decode(try call("newRun", [seed ?? NSNull(), deck]))
    }

    func restore(_ save: String) throws -> GameView {
        try decode(try call("restore", [save]))
    }

    func save() throws -> String { try call("save") }

    func view() throws -> GameView { try decode(try call("view")) }

    /// The player's profile (stats and history), brought up to date with this run.
    func noteProfile(_ json: String, id: String) throws -> String { try call("noteProfile", [json, id]) }

    /// Everything in the game, for the collection page.
    func catalog() throws -> CatalogV { try decode(try call("catalog")) }

    func act(_ action: Action) throws -> ActResult {
        try decode(try call("act", [action.json]))
    }

    /// Can the pack item in a shop slot be used on this card? Returns a reason if not.
    func canApply(slot: Int, cardId: Int) -> String? {
        guard let json = try? call("canApply", [slot, cardId]),
              let arr = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [Any],
              let ok = arr.first as? Bool else { return nil }
        return ok ? nil : (arr.count > 1 ? arr[1] as? String : "not allowed")
    }

    func pixels(_ function: String, _ args: [Any]) -> PixelData? {
        guard let json = try? call(function, args) else { return nil }
        return try? decode(json)
    }
}

/// An action the player (or the AI pacing) takes, encoded for the bridge.
enum Action {
    case pass([Int])
    case play(Int)
    case ai
    case playOut
    case `continue`
    case shop
    case buy(slot: Int, card: Int?)
    case sellRelic(Int)
    case reroll
    case leave
    case ploy(Int)
    case pick(Int)
    case skip
    case endless

    var json: String {
        let dict: [String: Any]
        switch self {
        case .pass(let ids): dict = ["t": "pass", "cards": ids]
        case .play(let id): dict = ["t": "play", "card": id]
        case .ai: dict = ["t": "ai"]
        case .playOut: dict = ["t": "playOut"]
        case .continue: dict = ["t": "continue"]
        case .shop: dict = ["t": "shop"]
        case .buy(let slot, let card):
            var d: [String: Any] = ["t": "buy", "slot": slot]
            if let card { d["card"] = card }
            dict = d
        case .sellRelic(let slot): dict = ["t": "sellRelic", "slot": slot]
        case .reroll: dict = ["t": "reroll"]
        case .leave: dict = ["t": "leave"]
        case .ploy(let slot): dict = ["t": "ploy", "slot": slot]
        case .pick(let index): dict = ["t": "pick", "index": index]
        case .skip: dict = ["t": "skip"]
        case .endless: dict = ["t": "endless"]
        }
        let data = try! JSONSerialization.data(withJSONObject: dict)
        return String(decoding: data, as: UTF8.self)
    }
}

struct PixelData: Decodable {
    let w: Int
    let h: Int
    let rgba: String
}
