extends Node
## Root game manager — switches between Island view and World Map view.
## Uses shared CloudTransition for smooth Boom Beach-style transitions.

enum View { ISLAND, WORLD_MAP }

var current_view := View.ISLAND
var _transitioning := false

# ── Node refs ──
@onready var island_view: Node3D = $IslandView
@onready var world_map_view: Node2D = $WorldMapView
@onready var cloud: CanvasLayer = $CloudTransition

# ── Map button overlay (shown on island) ──
var _map_btn_layer: CanvasLayer


var _status_label: Label
var _wallet_label: Label
var _balance_label: Label
var _wallet_btn: Button
var _wallet_layer: CanvasLayer

func _ready() -> void:
	# Start on island, world map hidden
	_show_island_immediate()

	# Build the "Map" button overlay for island view
	_build_map_button()

	# Connect Home button from world map HUD
	_connect_home_button()

	# Build wallet UI (Create Wallet button + info)
	_build_wallet_ui()

	# Connect to blockchain bridge
	_connect_blockchain()

	# Cloud reveal to start
	cloud._set_clouds_covering()
	await get_tree().process_frame
	cloud.reveal()


func _connect_home_button() -> void:
	# The HUD is at WorldMapView/UI and emits home_pressed
	var hud = world_map_view.get_node_or_null("UI")
	if hud and hud.has_signal("home_pressed"):
		hud.home_pressed.connect(switch_to_island)


# ══════════════════════════════════════
#  VIEW SWITCHING
# ══════════════════════════════════════

func switch_to_map() -> void:
	if current_view == View.WORLD_MAP or _transitioning:
		return
	_transitioning = true
	cloud.close()
	await cloud.close_finished
	_show_map_immediate()
	cloud.reveal()
	await cloud.reveal_finished
	_transitioning = false


func switch_to_island() -> void:
	if current_view == View.ISLAND or _transitioning:
		return
	_transitioning = true
	cloud.close()
	await cloud.close_finished
	_show_island_immediate()
	cloud.reveal()
	await cloud.reveal_finished
	_transitioning = false


func _show_island_immediate() -> void:
	current_view = View.ISLAND
	island_view.visible = true
	island_view.process_mode = Node.PROCESS_MODE_INHERIT
	# Show all island CanvasLayers (building UI etc.)
	_set_canvas_layers_visible(island_view, true)
	world_map_view.visible = false
	world_map_view.process_mode = Node.PROCESS_MODE_DISABLED
	# Hide world map CanvasLayers (HUD)
	_set_canvas_layers_visible(world_map_view, false)
	if _map_btn_layer:
		_map_btn_layer.visible = true


func _show_map_immediate() -> void:
	current_view = View.WORLD_MAP
	island_view.visible = false
	island_view.process_mode = Node.PROCESS_MODE_DISABLED
	# Hide all island CanvasLayers (building UI etc.)
	_set_canvas_layers_visible(island_view, false)
	world_map_view.visible = true
	world_map_view.process_mode = Node.PROCESS_MODE_INHERIT
	# Show world map CanvasLayers (HUD)
	_set_canvas_layers_visible(world_map_view, true)
	if _map_btn_layer:
		_map_btn_layer.visible = false


## Recursively find all CanvasLayer nodes in a subtree and set visibility.
## This is needed because CanvasLayers render independently of parent visibility.
func _set_canvas_layers_visible(root: Node, vis: bool) -> void:
	for child in root.get_children():
		if child is CanvasLayer:
			child.visible = vis
		_set_canvas_layers_visible(child, vis)


# ══════════════════════════════════════
#  MAP BUTTON (island overlay)
# ══════════════════════════════════════

func _build_map_button() -> void:
	_map_btn_layer = CanvasLayer.new()
	_map_btn_layer.name = "MapBtnOverlay"
	_map_btn_layer.layer = 50
	add_child(_map_btn_layer)

	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_map_btn_layer.add_child(root)

	var btn := Button.new()
	btn.name = "MapBtn"
	btn.text = "Map"
	btn.custom_minimum_size = Vector2(112, 48)
	btn.add_theme_font_size_override("font_size", 19)
	btn.add_theme_color_override("font_color", Color.WHITE)
	btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	btn.offset_left = -126
	btn.offset_top = -58
	btn.offset_right = -14
	btn.offset_bottom = -10

	# Blue-teal button style (distinct from green Home)
	btn.add_theme_stylebox_override("normal", _btn_style(
		Color(0.10, 0.28, 0.42, 0.92), Color(0.06, 0.18, 0.30, 1.0)))
	btn.add_theme_stylebox_override("hover", _btn_style(
		Color(0.14, 0.36, 0.52, 0.95), Color(0.08, 0.24, 0.38, 1.0)))
	btn.add_theme_stylebox_override("pressed", _btn_style(
		Color(0.06, 0.20, 0.32, 0.95), Color(0.04, 0.14, 0.24, 1.0)))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	btn.pressed.connect(switch_to_map)
	root.add_child(btn)


func _btn_style(bg: Color, border: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(22)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	return sb


# ══════════════════════════════════════
#  WALLET UI & BLOCKCHAIN
# ══════════════════════════════════════

func _build_wallet_ui() -> void:
	_wallet_layer = CanvasLayer.new()
	_wallet_layer.layer = 100
	add_child(_wallet_layer)

	var panel = PanelContainer.new()
	panel.anchor_left = 0.0
	panel.anchor_top = 0.0
	panel.offset_left = 8
	panel.offset_top = 8
	panel.offset_right = 320
	panel.offset_bottom = 110
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.07, 0.12, 0.9)
	style.set_corner_radius_all(12)
	style.set_border_width_all(1)
	style.border_color = Color(0.3, 0.35, 0.5, 0.6)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)
	_wallet_layer.add_child(panel)

	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)

	# Status line
	_status_label = Label.new()
	_status_label.text = "OFFLINE"
	_status_label.add_theme_font_size_override("font_size", 16)
	_status_label.add_theme_color_override("font_color", Color(1.0, 0.4, 0.3))
	vbox.add_child(_status_label)

	# Wallet address (hidden until created)
	_wallet_label = Label.new()
	_wallet_label.text = ""
	_wallet_label.add_theme_font_size_override("font_size", 11)
	_wallet_label.add_theme_color_override("font_color", Color(0.6, 0.65, 0.8))
	vbox.add_child(_wallet_label)

	# Balance
	_balance_label = Label.new()
	_balance_label.text = ""
	_balance_label.add_theme_font_size_override("font_size", 13)
	_balance_label.add_theme_color_override("font_color", Color(0.4, 0.9, 0.5))
	vbox.add_child(_balance_label)

	# Create Wallet button
	_wallet_btn = Button.new()
	_wallet_btn.text = "Create Wallet"
	_wallet_btn.custom_minimum_size = Vector2(140, 32)
	_wallet_btn.add_theme_font_size_override("font_size", 13)
	var btn_style = StyleBoxFlat.new()
	btn_style.bg_color = Color(0.15, 0.5, 0.3, 0.9)
	btn_style.set_corner_radius_all(8)
	btn_style.content_margin_left = 8
	btn_style.content_margin_right = 8
	btn_style.content_margin_top = 4
	btn_style.content_margin_bottom = 4
	_wallet_btn.add_theme_stylebox_override("normal", btn_style)
	var btn_hover = btn_style.duplicate()
	btn_hover.bg_color = Color(0.2, 0.6, 0.35, 0.95)
	_wallet_btn.add_theme_stylebox_override("hover", btn_hover)
	_wallet_btn.add_theme_color_override("font_color", Color.WHITE)
	_wallet_btn.pressed.connect(_on_create_wallet_pressed)
	vbox.add_child(_wallet_btn)


func _connect_blockchain() -> void:
	var bridge = get_node_or_null("/root/BlockchainBridge")
	if not bridge:
		return
	bridge.sync_status_changed.connect(_on_sync_status_changed)
	bridge.blockchain_event.connect(_on_blockchain_event)
	bridge.wallet_ready.connect(_on_wallet_ready)


func _on_create_wallet_pressed() -> void:
	_wallet_btn.text = "Creating..."
	_wallet_btn.disabled = true
	var bridge = get_node_or_null("/root/BlockchainBridge")
	if bridge:
		bridge.create_wallet()


func _on_wallet_ready(pubkey: String, balance: float) -> void:
	# Show short address: Abc...xyz
	var short_addr = pubkey.substr(0, 6) + "..." + pubkey.substr(pubkey.length() - 4)
	_wallet_label.text = short_addr
	_balance_label.text = "%.2f SOL" % balance
	_wallet_btn.visible = false


func _on_sync_status_changed(is_synced: bool) -> void:
	if _status_label:
		if is_synced:
			_status_label.text = "ON-CHAIN"
			_status_label.add_theme_color_override("font_color", Color(0.3, 1.0, 0.4))
		else:
			_status_label.text = "OFFLINE"
			_status_label.add_theme_color_override("font_color", Color(1.0, 0.4, 0.3))


func _on_blockchain_event(event_type: String, data: Dictionary) -> void:
	match event_type:
		"connected":
			print("[GameManager] Connected to blockchain: %s" % data.get("pubkey", ""))
		"village_data":
			print("[GameManager] Village data received from chain")
		"matchmake_result":
			var opponent = data.get("opponent", {})
			print("[GameManager] Opponent found: %s" % opponent.get("displayName", "Unknown"))
		"error":
			print("[GameManager] Blockchain error: %s" % data.get("message", ""))
			# Re-enable button on error
			if _wallet_btn:
				_wallet_btn.text = "Create Wallet"
				_wallet_btn.disabled = false
