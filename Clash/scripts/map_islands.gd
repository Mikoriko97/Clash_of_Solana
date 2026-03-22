extends Node2D
## Generates glowing Boom Beach-style name plates below each island.
## Island1 = player's base (highlighted), the rest = fake rival names.

const MY_ISLAND := 0

const NAMES := [
	"My Base",
	"Captain Rex",
	"SeaWolf 42",
	"Dark Raider",
	"Tropic Storm",
	"Iron Shark",
	"Coral King",
	"Blaze Pirate",
	"NightHawk 7",
	"Storm Breaker",
	"Ocean Fury",
	"Shadow Fleet",
]

# ── Style ────────────────────────────────────────────────────────
# Player's island — warm gold glow
const C_MY_GLOW     := Color(1.0, 0.82, 0.15, 0.22)
const C_MY_BG       := Color(0.06, 0.10, 0.02, 0.92)
const C_MY_BORDER   := Color(0.90, 0.68, 0.10, 0.95)
const C_MY_TEXT     := Color(1.0, 0.88, 0.28, 1.0)

# Enemy islands — cool blue-white glow
const C_FOE_GLOW    := Color(0.5, 0.65, 0.9, 0.16)
const C_FOE_BG      := Color(0.04, 0.04, 0.07, 0.88)
const C_FOE_BORDER  := Color(0.42, 0.40, 0.35, 0.65)
const C_FOE_TEXT    := Color(0.88, 0.90, 0.95, 1.0)

# ── Pulse animation for player's island ──
var _my_glow: Panel
var _my_panel: PanelContainer
var _pulse_time := 0.0


func _ready() -> void:
	_build_labels()


func _process(delta: float) -> void:
	if not _my_glow:
		return
	_pulse_time += delta * 2.2
	var pulse := (sin(_pulse_time) + 1.0) * 0.5  # 0..1
	# Glow alpha pulses gently
	var gsb: StyleBoxFlat = _my_glow.get_theme_stylebox("panel")
	gsb.bg_color.a = lerpf(0.15, 0.35, pulse)
	# Border brightness pulses
	var sb: StyleBoxFlat = _my_panel.get_theme_stylebox("panel")
	sb.border_color = Color(
		lerpf(0.85, 1.0, pulse),
		lerpf(0.60, 0.78, pulse),
		lerpf(0.08, 0.20, pulse),
		0.95
	)


func _build_labels() -> void:
	var idx := 0
	for child in get_children():
		if not (child is Node2D and child.name.begins_with("Island")):
			continue

		var spr: Sprite2D = child.get_node_or_null("Island")
		if not spr:
			idx += 1
			continue

		var pname: String = NAMES[idx] if idx < NAMES.size() else "Player %d" % (idx + 1)
		var mine: bool = (idx == MY_ISLAND)

		var y_off: float = spr.scale.y * 500.0 + 50.0
		_nameplate(child, pname, y_off, mine)
		idx += 1


func _nameplate(parent: Node2D, text: String, y_off: float, mine: bool) -> void:
	# ── Outer glow layer ──
	var glow := Panel.new()
	glow.z_index = 9
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gsb := StyleBoxFlat.new()
	gsb.bg_color = C_MY_GLOW if mine else C_FOE_GLOW
	gsb.set_corner_radius_all(26)
	gsb.set_border_width_all(0)
	glow.add_theme_stylebox_override("panel", gsb)
	parent.add_child(glow)

	# ── Main nameplate ──
	var panel := PanelContainer.new()
	panel.z_index = 10
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var sb := StyleBoxFlat.new()
	sb.bg_color = C_MY_BG if mine else C_FOE_BG
	sb.border_color = C_MY_BORDER if mine else C_FOE_BORDER
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.content_margin_left  = 22 if mine else 16
	sb.content_margin_right = 22 if mine else 16
	sb.content_margin_top    = 8
	sb.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", sb)

	# ── Star icon for player's island ──
	if mine:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE

		var star := Label.new()
		star.text = "\u2B50"
		star.add_theme_font_size_override("font_size", 26)
		star.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(star)

		var lbl := Label.new()
		lbl.text = text
		lbl.add_theme_font_size_override("font_size", 32)
		lbl.add_theme_color_override("font_color", C_MY_TEXT)
		lbl.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
		lbl.add_theme_constant_override("shadow_offset_x", 2)
		lbl.add_theme_constant_override("shadow_offset_y", 2)
		lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(lbl)

		panel.add_child(row)
	else:
		var lbl := Label.new()
		lbl.text = text
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.add_theme_font_size_override("font_size", 26)
		lbl.add_theme_color_override("font_color", C_FOE_TEXT)
		lbl.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
		lbl.add_theme_constant_override("shadow_offset_x", 2)
		lbl.add_theme_constant_override("shadow_offset_y", 2)
		lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		panel.add_child(lbl)

	parent.add_child(panel)
	panel.position.y = y_off

	# Save refs for player's plate animation
	if mine:
		_my_glow = glow
		_my_panel = panel

	# Center panel + size glow to wrap around it
	panel.resized.connect(func():
		panel.position.x = -panel.size.x * 0.5
		glow.size = panel.size + Vector2(28, 18)
		glow.position = Vector2(panel.position.x - 14, panel.position.y - 9)
	)
