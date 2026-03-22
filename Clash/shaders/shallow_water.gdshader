shader_type canvas_item;

// Shallow water halo — lighter tint around islands, simulating visible seabed.
uniform vec4 color : source_color = vec4(0.15, 0.55, 0.75, 0.25);
uniform float blur_size : hint_range(0.0, 0.15, 0.001) = 0.06;
uniform float alpha_cutoff : hint_range(0.0, 1.0, 0.01) = 0.1;

float safe_alpha(vec2 uv, float cutoff) {
	float inside = step(0.001, uv.x) * step(0.001, 1.0 - uv.x) *
	               step(0.001, uv.y) * step(0.001, 1.0 - uv.y);
	return step(cutoff, texture(TEXTURE, uv).a) * inside;
}

void fragment() {
	// 9-tap disc blur for soft edges
	float a = safe_alpha(UV, alpha_cutoff) * 2.0;
	float tw = 2.0;
	for (int i = 0; i < 8; i++) {
		float ang = float(i) * 0.7854;
		vec2 off = vec2(cos(ang), sin(ang)) * blur_size;
		a += safe_alpha(UV + off, alpha_cutoff);
		tw += 1.0;
	}
	a /= tw;

	COLOR = vec4(color.rgb, color.a * a);
}
