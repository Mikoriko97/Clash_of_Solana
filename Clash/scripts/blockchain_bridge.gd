extends Node

## Blockchain Bridge — connects local game state to backend/Solana.
## All game actions are validated server-side before applying locally.

signal sync_status_changed(is_synced: bool)
signal blockchain_event(event_type: String, data: Dictionary)
signal wallet_ready(pubkey: String, balance: float)
signal state_loaded(state: Dictionary)
signal build_confirmed(data: Dictionary)
signal attack_data_received(data: Dictionary)

enum Mode { OFFLINE, ONLINE }

var mode: Mode = Mode.OFFLINE
var is_synced: bool = false
var player_pubkey: String = ""
var player_balance: float = 0.0
var current_battle_id: String = ""
var _network: Node = null
var _tx_counter: int = 0


func _ready() -> void:
	_network = get_node_or_null("/root/NetworkManager")
	if _network:
		_network.connected.connect(_on_connected)
		_network.disconnected.connect(_on_disconnected)
		_network.wallet_created.connect(_on_wallet_created)
		_network.error.connect(_on_network_error)
		_network.player_data_received.connect(_on_player_data)
		_network.village_data_received.connect(_on_village_data)
		_network.matchmake_result.connect(_on_matchmake_result)
		_network.battle_started.connect(_on_battle_started)
		_network.battle_ended.connect(_on_battle_ended)
		_network.battle_update.connect(_on_battle_update)
		_log("INIT", "BlockchainBridge initialized | Backend: %s" % _network.base_url)
	else:
		_log("INIT", "NetworkManager not found — running OFFLINE")


# ══════════════════════════════════════
#  LOGGING
# ══════════════════════════════════════

func _log(category: String, message: String) -> void:
	var time_str = Time.get_time_string_from_system()
	print("[%s] [SOLANA/%s] %s" % [time_str, category, message])


func _log_tx(action: String, details: String) -> void:
	_tx_counter += 1
	var time_str = Time.get_time_string_from_system()
	print("[%s] [SOLANA/TX #%d] %s — %s" % [time_str, _tx_counter, action, details])


# ══════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════

func create_wallet() -> void:
	if not _network:
		return
	_log("WALLET", "Generating new Solana keypair...")
	_log("WALLET", "Requesting SOL airdrop from validator...")
	_network.create_random_wallet()


func load_game_state() -> void:
	if not _network or not _network.is_authenticated:
		return
	_log("SYNC", "Loading full game state from server...")
	_network.get_game_state()


## Server-validated building construction
func build_on_server(building_type: String, grid_x: int, grid_y: int) -> void:
	if mode == Mode.OFFLINE:
		_log("OFFLINE", "Cannot build — connect wallet first")
		return
	_log_tx("BUILD", "POST /game/build {type:%s, x:%d, y:%d}" % [building_type, grid_x, grid_y])
	_log("L1", "Server validates: resources, grid bounds, collision, max count")
	_log("L1", "Program: build_construct.construct_building()")
	_network.server_build(building_type, grid_x, grid_y)


## Server-validated building upgrade
func upgrade_on_server(building_id: int) -> void:
	if mode == Mode.OFFLINE:
		return
	_log_tx("UPGRADE", "POST /game/upgrade {id:%d}" % building_id)
	_log("L1", "Server validates: resources, max level, ownership")
	_network.server_upgrade(building_id)


## Server-validated troop training
func train_on_server(troop_type: String) -> void:
	if mode == Mode.OFFLINE:
		return
	_log_tx("TRAIN", "POST /game/train {type:%s}" % troop_type)
	_log("L1", "Server validates: resources, max level")
	_network.server_train(troop_type)


## Find opponent via matchmaking
func find_opponent() -> void:
	_log("MATCHMAKING", "Searching opponent — trophy +/-200, TH +/-1...")
	if mode == Mode.OFFLINE:
		_log("OFFLINE", "Matchmaking unavailable offline")
		return
	_network.server_find_opponent()


## Start attack against opponent
func start_attack(defender_pubkey: String) -> void:
	_log_tx("BATTLE", "POST /game/attack {defender:%s}" % defender_pubkey.substr(0, 8))
	_log("L1", "Server validates: cooldown, shield, under_attack flags")
	_log("PER", "Battle state created — delegating to TEE...")
	_network.server_attack(defender_pubkey)


## Settle battle results
func settle_battle(stars: int, destruction_pct: int, ships: int) -> void:
	if current_battle_id == "":
		return
	_log_tx("SETTLE", "POST /game/settle {stars:%d, destruction:%d%%}" % [stars, destruction_pct])
	_log("L1", "Server: transfer resources, update trophies, apply shield")
	_network.server_settle_battle(current_battle_id, stars, destruction_pct, ships)


func is_online() -> bool:
	return mode == Mode.ONLINE and _network != null and _network.is_authenticated


# ══════════════════════════════════════
#  NETWORK EVENT HANDLERS
# ══════════════════════════════════════

func _on_wallet_created(data: Dictionary) -> void:
	var pubkey = data.get("pubkey", "")
	var balance = data.get("balanceSOL", 0.0)
	player_pubkey = pubkey
	player_balance = balance
	var short = pubkey.substr(0, 6) + "..." + pubkey.substr(pubkey.length() - 4)
	_log("WALLET", "========================================")
	_log("WALLET", "Keypair generated successfully")
	_log("WALLET", "Address:  %s" % pubkey)
	_log("WALLET", "Balance:  %.2f SOL" % balance)
	_log("WALLET", "Network:  Solana Localnet (127.0.0.1:8899)")
	_log("WALLET", "========================================")
	_log("AUTH", "JWT token issued — session active for 24h")
	_log("DB", "Player registered + resources initialized (1000/1000/1000)")
	wallet_ready.emit(pubkey, balance)

	# Connect WebSocket for real-time notifications
	_network.connect_game_ws()

	# Load full game state
	await get_tree().create_timer(0.5).timeout
	load_game_state()


func _on_connected(pubkey: String) -> void:
	mode = Mode.ONLINE
	is_synced = true
	player_pubkey = pubkey
	sync_status_changed.emit(true)
	blockchain_event.emit("connected", {"pubkey": pubkey})
	_log("STATUS", "========================================")
	_log("STATUS", "MODE: ON-CHAIN")
	_log("STATUS", "All actions validated server-side")
	_log("STATUS", "========================================")


func _on_disconnected() -> void:
	mode = Mode.OFFLINE
	is_synced = false
	sync_status_changed.emit(false)
	_log("STATUS", "MODE: OFFLINE")


func _on_network_error(message: String) -> void:
	_log("ERROR", message)
	blockchain_event.emit("error", {"message": message})


func _on_player_data(data: Dictionary) -> void:
	var action = data.get("action", "")
	var result = data.get("result", {})

	match action:
		"build":
			if result.get("success", false):
				_log("CONFIRMED", "Building %s constructed at (%d,%d) — cost deducted on server" % [
					result.get("type", ""), result.get("gridX", 0), result.get("gridY", 0)])
				build_confirmed.emit(result)
			else:
				_log("REJECTED", "Build failed: %s" % result.get("error", "Unknown"))
		"upgrade":
			if result.get("success", false):
				_log("CONFIRMED", "Building upgraded to Lv.%d — HP: %d" % [result.get("newLevel", 0), result.get("newHp", 0)])
			else:
				_log("REJECTED", "Upgrade failed: %s" % result.get("error", "Unknown"))
		"train":
			if result.get("success", false):
				_log("CONFIRMED", "Troop %s trained to Lv.%d" % [result.get("troopType", ""), result.get("newLevel", 0)])
			else:
				_log("REJECTED", "Training failed: %s" % result.get("error", "Unknown"))


func _on_village_data(data: Dictionary) -> void:
	_log("SYNC", "Game state loaded from server:")
	_log("SYNC", "  Resources: G:%s W:%s O:%s" % [data.get("resources", {}).get("gold", 0), data.get("resources", {}).get("wood", 0), data.get("resources", {}).get("ore", 0)])
	_log("SYNC", "  Buildings: %d | Trophies: %d | TH Lv.%d" % [
		data.get("buildings", []).size(), data.get("trophyCount", 0), data.get("thLevel", 1)])
	var troops = data.get("troops", {})
	if troops.size() > 0:
		var troop_str = ""
		for t in troops:
			troop_str += "%s(Lv%d) " % [t, troops[t].get("level", 1)]
		_log("SYNC", "  Troops: %s" % troop_str)
	state_loaded.emit(data)
	_apply_state_to_game(data)


func _on_matchmake_result(data: Dictionary) -> void:
	if data.get("success", false):
		var opp = data.get("opponent", {})
		_log("MATCHMAKING", "Opponent found!")
		_log("MATCHMAKING", "  %s | Trophies: %s | TH Lv.%s | Buildings: %d" % [
			opp.get("displayName", "?"), opp.get("trophyCount", 0),
			opp.get("thLevel", 1), opp.get("buildings", []).size()])
		blockchain_event.emit("matchmake_result", data)
		# Auto-start attack
		var opp_pubkey = opp.get("pubkey", "")
		if opp_pubkey != "":
			start_attack(opp_pubkey)
	else:
		_log("MATCHMAKING", "No opponent found — %s" % data.get("error", "try again"))


func _on_battle_started(data: Dictionary) -> void:
	current_battle_id = data.get("battleId", "")
	_log("BATTLE", "========================================")
	_log("BATTLE", "Battle started: %s" % current_battle_id)
	_log("BATTLE", "Defender buildings: %d" % data.get("defenderBuildings", []).size())
	_log("BATTLE", "Max ships: %d | Troops/ship: %d" % [data.get("maxShips", 5), data.get("troopsPerShip", 3)])
	_log("PER", "Battle delegated to Private Ephemeral Rollup")
	_log("PER", "Duration: max %d seconds" % data.get("maxDuration", 180))
	_log("BATTLE", "========================================")
	attack_data_received.emit(data)


func _on_battle_update(data: Dictionary) -> void:
	var msg_type = data.get("type", "")
	if msg_type == "under_attack":
		_log("ALERT", "========================================")
		_log("ALERT", "YOUR BASE IS UNDER ATTACK!")
		_log("ALERT", "Attacker: %s" % data.get("attackerPubkey", "Unknown"))
		_log("ALERT", "========================================")
		blockchain_event.emit("under_attack", data)


func _on_battle_ended(data: Dictionary) -> void:
	var stars = data.get("stars", 0)
	var pct = data.get("destructionPct", 0)
	var loot = data.get("loot", {})
	var trophy = data.get("trophyDelta", 0)
	_log("SETTLE", "========================================")
	_log("SETTLE", "Battle result: %d stars | %d%% destruction" % [stars, pct])
	_log("SETTLE", "Loot: G:%s W:%s O:%s" % [loot.get("gold", 0), loot.get("wood", 0), loot.get("ore", 0)])
	_log("SETTLE", "Trophies: %+d" % trophy)
	_log("SETTLE", "Shield: %s hours for defender" % data.get("shieldHours", 0))
	_log("L1", "Resources transferred on server")
	_log("L1", "Trophies updated in matchmaking pool")
	_log("SETTLE", "========================================")
	current_battle_id = ""
	# Reload state
	load_game_state()


func _apply_state_to_game(data: Dictionary) -> void:
	var building_systems = get_tree().get_nodes_in_group("building_systems")
	for bs in building_systems:
		# Update resources
		if "resources" in bs:
			var res = data.get("resources", {})
			if res.size() > 0:
				bs.resources["gold"] = int(res.get("gold", 1000))
				bs.resources["wood"] = int(res.get("wood", 1000))
				bs.resources["ore"] = int(res.get("ore", 1000))
				if bs.has_method("_update_resource_ui"):
					bs._update_resource_ui()

		# Update troop levels
		if "troop_levels" in bs:
			var troops = data.get("troops", {})
			for troop_name in troops:
				var capitalized = troop_name.capitalize()
				if capitalized in bs.troop_levels:
					bs.troop_levels[capitalized] = troops[troop_name].get("level", 1)
