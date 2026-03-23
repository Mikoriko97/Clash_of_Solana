extends Node

## Battle Tracker — tracks real battle progress and submits results.
## Add as AutoLoad: Name: "BattleTracker"

signal battle_progress(destruction_pct: int, stars: int)
signal battle_finished(stars: int, destruction_pct: int, ships_deployed: int)

var is_tracking: bool = false
var total_buildings: int = 0
var destroyed_buildings: int = 0
var ships_deployed: int = 0
var has_town_hall_destroyed: bool = false
var _timer: float = 0.0
var _max_duration: float = 180.0
var _battle_started_at: float = 0.0


func _ready() -> void:
	pass


func _process(delta: float) -> void:
	if not is_tracking:
		return
	_timer += delta
	# Timeout
	if _timer >= _max_duration:
		_end_battle("timeout")


func start_tracking() -> void:
	is_tracking = true
	destroyed_buildings = 0
	ships_deployed = 0
	has_town_hall_destroyed = false
	_timer = 0.0
	_battle_started_at = Time.get_unix_time_from_system()

	# Count total buildings from all building systems
	total_buildings = 0
	for bs in get_tree().get_nodes_in_group("building_systems"):
		if "placed_buildings" in bs:
			total_buildings += bs.placed_buildings.size()

	print("[BattleTracker] Started — %d buildings to destroy, 180s limit" % total_buildings)


func on_ship_deployed() -> void:
	ships_deployed += 1
	print("[BattleTracker] Ship %d/5 deployed" % ships_deployed)


func on_building_destroyed(building_id: String) -> void:
	if not is_tracking:
		return
	destroyed_buildings += 1
	if building_id == "town_hall":
		has_town_hall_destroyed = true

	var pct = get_destruction_pct()
	var stars = get_stars()
	battle_progress.emit(pct, stars)
	print("[BattleTracker] Building destroyed: %s | %d%% | %d★" % [building_id, pct, stars])

	# Check if all buildings destroyed
	if destroyed_buildings >= total_buildings and total_buildings > 0:
		_end_battle("all_destroyed")


func get_destruction_pct() -> int:
	if total_buildings == 0:
		return 0
	return int(float(destroyed_buildings) / float(total_buildings) * 100.0)


func get_stars() -> int:
	var pct = get_destruction_pct()
	if pct >= 100:
		return 3
	elif pct >= 75 or (pct >= 50 and has_town_hall_destroyed):
		return 2
	elif pct >= 50 or has_town_hall_destroyed:
		return 1
	return 0


func _end_battle(reason: String) -> void:
	if not is_tracking:
		return
	is_tracking = false

	var pct = get_destruction_pct()
	var stars = get_stars()
	var duration = Time.get_unix_time_from_system() - _battle_started_at

	print("[BattleTracker] ========================================")
	print("[BattleTracker] Battle ended: %s" % reason)
	print("[BattleTracker] Result: %d★ | %d%% | %d ships | %.0fs" % [stars, pct, ships_deployed, duration])
	print("[BattleTracker] ========================================")

	battle_finished.emit(stars, pct, ships_deployed)

	# Submit to blockchain
	var bridge = get_node_or_null("/root/BlockchainBridge")
	if bridge and bridge.is_online():
		bridge.settle_battle(stars, pct, ships_deployed)
