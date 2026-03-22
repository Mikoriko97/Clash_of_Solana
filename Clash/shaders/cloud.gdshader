shader_type canvas_item;
// Minimal cloud shader — samples a pre-generated noise texture,
// applies soft circular edge and progress fade.
// Cost: 1 texture sample + 1 smoothstep + basic math. Very cheap.

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform float softness : hint_range(0.05, 1.0) = 0.35;

void fragment() {
	vec2 c = (UV - 0.5) * 2.0;
	float dist = length(c);
	float edge = smoothstep(1.0, softness, dist);

	float n = texture(TEXTURE, UV).r;
	float cloud = smoothstep(0.32, 0.58, n) * edge;

	// Soft white-blue tint, slightly varies with noise
	vec3 col = mix(vec3(0.91, 0.93, 0.97), vec3(1.0), n * 0.6 + 0.4);
	COLOR = vec4(col, cloud * progress);
}
