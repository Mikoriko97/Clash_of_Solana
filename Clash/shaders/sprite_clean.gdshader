shader_type canvas_item;

// Clips semi-transparent PNG background noise while preserving original colors.
uniform float alpha_cutoff : hint_range(0.0, 1.0, 0.01) = 0.45;
uniform float border_margin : hint_range(0.0, 0.05, 0.001) = 0.01;

void fragment() {
	float bm = border_margin;
	float inside = step(bm, UV.x) * step(bm, 1.0 - UV.x) *
	               step(bm, UV.y) * step(bm, 1.0 - UV.y);
	vec4 tex = texture(TEXTURE, UV);
	float clean_a = step(alpha_cutoff, tex.a) * inside;
	COLOR = vec4(tex.rgb, tex.a * clean_a);
}
