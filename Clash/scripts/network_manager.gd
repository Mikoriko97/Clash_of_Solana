extends Node

## Network Manager — bridge between Godot client and Clash of Solana backend.
## Handles HTTP requests, JWT auth, WebSocket for battle updates.

signal connected(pubkey: String)
signal disconnected()
signal player_data_received(data: Dictionary)
signal village_data_received(data: Dictionary)
signal battle_started(data: Dictionary)
signal battle_update(data: Dictionary)
signal battle_ended(data: Dictionary)
signal matchmake_result(data: Dictionary)
signal error(message: String)

const DEFAULT_BASE_URL := "http://localhost:3000"
const API_PREFIX := "/api/v1"

var base_url: String = DEFAULT_BASE_URL
var jwt_token: String = ""
var player_pubkey: String = ""
var is_authenticated: bool = false

var _http_request: HTTPRequest
var _ws_client: WebSocketPeer
var _ws_url: String = ""
var _pending_requests: Dictionary = {}
var _request_id: int = 0


func _ready() -> void:
	_http_request = HTTPRequest.new()
	_http_request.request_completed.connect(_on_request_completed)
	add_child(_http_request)


func _process(_delta: float) -> void:
	if _ws_client and _ws_client.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		_ws_client.poll()
		while _ws_client.get_available_packet_count() > 0:
			var packet := _ws_client.get_packet()
			var text := packet.get_string_from_utf8()
			_handle_ws_message(text)


# ── Authentication ────────────────────────────────────────────

## Connect wallet — verify signature and get JWT token.
## In production, signature comes from Solana wallet adapter.
func connect_wallet(pubkey: String, signature: String, message: String) -> void:
	var body := {
		"pubkey": pubkey,
		"signature": signature,
		"message": message
	}
	_api_post("/auth/connect", body, "_on_auth_connect")


func refresh_token() -> void:
	_api_post("/auth/refresh", {}, "_on_auth_refresh")


func disconnect_wallet() -> void:
	jwt_token = ""
	player_pubkey = ""
	is_authenticated = false
	if _ws_client:
		_ws_client.close()
	disconnected.emit()


# ── Player Data ───────────────────────────────────────────────

func get_player_profile(pubkey: String = "") -> void:
	var pk := pubkey if pubkey != "" else player_pubkey
	_api_get("/player/%s" % pk, "_on_player_profile")


func get_village_state(pubkey: String = "") -> void:
	var pk := pubkey if pubkey != "" else player_pubkey
	_api_get("/player/%s/village" % pk, "_on_village_state")


func get_army(pubkey: String = "") -> void:
	var pk := pubkey if pubkey != "" else player_pubkey
	_api_get("/player/%s/army" % pk, "_on_army_data")


func get_battle_history(pubkey: String = "") -> void:
	var pk := pubkey if pubkey != "" else player_pubkey
	_api_get("/player/%s/history" % pk, "_on_battle_history")


# ── Battle ────────────────────────────────────────────────────

func find_opponent() -> void:
	_api_post("/battle/matchmake", {}, "_on_matchmake")


func prepare_battle(defender_pubkey: String) -> void:
	_api_post("/battle/prepare", {"defenderPubkey": defender_pubkey}, "_on_battle_prepare")


func get_battle_details(battle_id: String) -> void:
	_api_get("/battle/%s" % battle_id, "_on_battle_details")


func get_battle_replay(battle_id: String) -> void:
	_api_get("/battle/%s/replay" % battle_id, "_on_battle_replay")


# ── Leaderboard ───────────────────────────────────────────────

func get_global_leaderboard() -> void:
	_api_get("/leaderboard/global", "_on_leaderboard")


func get_league_leaderboard(league: int) -> void:
	_api_get("/leaderboard/league/%d" % league, "_on_leaderboard")


# ── Shop ──────────────────────────────────────────────────────

func get_shop_offers() -> void:
	_api_get("/shop/offers", "_on_shop_offers")


func purchase(offer_id: String, tx_signature: String) -> void:
	_api_post("/shop/purchase", {
		"offerId": offer_id,
		"txSignature": tx_signature
	}, "_on_shop_purchase")


# ── Health ────────────────────────────────────────────────────

func check_health() -> void:
	var url := base_url + "/health"
	_http_request.request(url, [], HTTPClient.METHOD_GET)


# ── Internal HTTP helpers ─────────────────────────────────────

func _api_get(endpoint: String, callback: String) -> void:
	_request_id += 1
	var url := base_url + API_PREFIX + endpoint
	var headers := _get_headers()
	_pending_requests[_request_id] = callback

	var http := HTTPRequest.new()
	http.request_completed.connect(_on_generic_request_completed.bind(_request_id, http))
	add_child(http)
	http.request(url, headers, HTTPClient.METHOD_GET)


func _api_post(endpoint: String, body: Dictionary, callback: String) -> void:
	_request_id += 1
	var url := base_url + API_PREFIX + endpoint
	var headers := _get_headers()
	headers.append("Content-Type: application/json")
	_pending_requests[_request_id] = callback

	var json_body := JSON.stringify(body)
	var http := HTTPRequest.new()
	http.request_completed.connect(_on_generic_request_completed.bind(_request_id, http))
	add_child(http)
	http.request(url, headers, HTTPClient.METHOD_POST, json_body)


func _get_headers() -> PackedStringArray:
	var headers := PackedStringArray()
	if jwt_token != "":
		headers.append("Authorization: Bearer %s" % jwt_token)
	return headers


func _on_generic_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, req_id: int, http_node: HTTPRequest) -> void:
	http_node.queue_free()

	if not _pending_requests.has(req_id):
		return

	var callback: String = _pending_requests[req_id]
	_pending_requests.erase(req_id)

	if result != HTTPRequest.RESULT_SUCCESS:
		error.emit("HTTP request failed: %d" % result)
		return

	var json := JSON.new()
	var parse_result := json.parse(body.get_string_from_utf8())
	if parse_result != OK:
		error.emit("Failed to parse response JSON")
		return

	var data: Dictionary = json.data if json.data is Dictionary else {}
	data["_response_code"] = response_code

	if has_method(callback):
		call(callback, data)


# ── Response handlers ─────────────────────────────────────────

func _on_auth_connect(data: Dictionary) -> void:
	if data.get("success", false):
		jwt_token = data.get("token", "")
		player_pubkey = data.get("pubkey", "")
		is_authenticated = true
		connected.emit(player_pubkey)
		print("[NetworkManager] Authenticated as: ", player_pubkey)
	else:
		error.emit("Auth failed: %s" % data.get("error", "Unknown error"))


func _on_auth_refresh(data: Dictionary) -> void:
	if data.get("success", false):
		jwt_token = data.get("token", "")
		print("[NetworkManager] Token refreshed")
	else:
		error.emit("Token refresh failed")
		disconnect_wallet()


func _on_player_profile(data: Dictionary) -> void:
	player_data_received.emit(data)


func _on_village_state(data: Dictionary) -> void:
	village_data_received.emit(data)


func _on_army_data(data: Dictionary) -> void:
	player_data_received.emit({"army": data})


func _on_battle_history(data: Dictionary) -> void:
	player_data_received.emit({"history": data})


func _on_matchmake(data: Dictionary) -> void:
	matchmake_result.emit(data)


func _on_battle_prepare(data: Dictionary) -> void:
	battle_started.emit(data)


func _on_battle_details(data: Dictionary) -> void:
	battle_ended.emit(data)


func _on_battle_replay(data: Dictionary) -> void:
	player_data_received.emit({"replay": data})


func _on_leaderboard(data: Dictionary) -> void:
	player_data_received.emit({"leaderboard": data})


func _on_shop_offers(data: Dictionary) -> void:
	player_data_received.emit({"shop": data})


func _on_shop_purchase(data: Dictionary) -> void:
	player_data_received.emit({"purchase": data})


func _on_request_completed(_result: int, _response_code: int, _headers: PackedStringArray, _body: PackedByteArray) -> void:
	pass


# ── WebSocket for battle updates ─────────────────────────────

func connect_battle_ws(battle_id: String) -> void:
	_ws_url = base_url.replace("http", "ws") + "/api/v1/battle/%s/ws" % battle_id

	_ws_client = WebSocketPeer.new()
	var err := _ws_client.connect_to_url(_ws_url)
	if err != OK:
		error.emit("WebSocket connection failed: %d" % err)
		return

	print("[NetworkManager] WebSocket connecting to: ", _ws_url)


func disconnect_battle_ws() -> void:
	if _ws_client:
		_ws_client.close()
		_ws_client = null


func _handle_ws_message(text: String) -> void:
	var json := JSON.new()
	var parse_result := json.parse(text)
	if parse_result != OK:
		return

	var data: Dictionary = json.data if json.data is Dictionary else {}
	var msg_type: String = data.get("type", "")

	match msg_type:
		"battle_update":
			battle_update.emit(data)
		"battle_end":
			battle_ended.emit(data)
		_:
			print("[NetworkManager] Unknown WS message: ", msg_type)
