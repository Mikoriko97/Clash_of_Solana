shader_type canvas_item;

// Solid-color silhouette with lightweight blur and optional pulse.
// border_margin masks out texture-edge artifacts from PNGs with noisy borders.
uniform vec4 color : source_color = vec4(0.2, 0.8, 0.7, 0.2);
uniform float pulse_speed  : hint_range(0.0, 5.0) = 0.0;
uniform float pulse_amount : hint_range(0.0, 0.3) = 0.0;
uniform float blur_size    : hint_range(0.0, 0.1, 0.001) = 0.0;
uniform float alpha_cutoff : hint_range(0.0, 1.0, 0.01) = 0.45;
uniform float border_margin : hint_range(0.0, 0.05, 0.001) = 0.01;

// Returns cleaned alpha: cutoff + border mask applied per sample
float safe_alpha(vec2 uv, float cutoff, float bm) {
	float inside = step(bm, uv.x) * step(bm, 1.0 - uv.x) *
	               step(bm, uv.y) * step(bm, 1.0 - uv.y);
	return step(cutoff, texture(TEXTURE, uv).a) * inside;
}

void fragment() {
	float a;
	if (blur_size > 0.001) {
		// 9-tap weighted disc blur (center + 8 ring)
		a = safe_alpha(UV, alpha_cutoff, border_margin) * 2.0;
		float tw = 2.0;
		for (int i = 0; i < 8; i++) {
			float ang = float(i) * 0.7854;
			vec2 off = vec2(cos(ang), sin(ang)) * blur_size;
			a += safe_alpha(UV + off, alpha_cutoff, border_margin);
			tw += 1.0;
		}
		a /= tw;
	} else {
		a = safe_alpha(UV, alpha_cutoff, border_margin);
	}
	float pulse = sin(TIME * pulse_speed + UV.x * 12.0 + UV.y * 10.0) * pulse_amount;
	COLOR = vec4(color.rgb, clamp(color.a * a + pulse * a, 0.0, 1.0));
}
