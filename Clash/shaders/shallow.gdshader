shader_type canvas_item;

// Shallow water halo — tropical turquoise tint around islands.
uniform vec4 color : source_color = vec4(0.18, 0.65, 0.72, 0.20);
uniform float blur_size : hint_range(0.0, 0.15, 0.001) = 0.05;
uniform float alpha_cutoff : hint_range(0.0, 1.0, 0.01) = 0.1;

void fragment() {
	float inside = step(0.001, UV.x) * step(0.001, 1.0 - UV.x) *
	               step(0.001, UV.y) * step(0.001, 1.0 - UV.y);
	float a = step(alpha_cutoff, texture(TEXTURE, UV).a) * inside * 2.0;
	float tw = 2.0;
	for (int i = 0; i < 8; i++) {
		float ang = float(i) * 0.7854;
		vec2 off = vec2(cos(ang), sin(ang)) * blur_size;
		vec2 suv = UV + off;
		float si = step(0.001, suv.x) * step(0.001, 1.0 - suv.x) *
		           step(0.001, suv.y) * step(0.001, 1.0 - suv.y);
		a += step(alpha_cutoff, texture(TEXTURE, suv).a) * si;
		tw += 1.0;
	}
	a /= tw;
	COLOR = vec4(color.rgb, color.a * a);
}
