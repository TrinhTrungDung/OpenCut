vec4 transition(vec2 uv) {
  float strength = progress * (1.0 - progress) * 4.0;
  vec2 texelSize = vec2(1.0) / vec2(1920.0, 1080.0);
  vec4 color = vec4(0.0);
  float total = 0.0;
  float radius = strength * 20.0;

  for (int i = -10; i <= 10; i++) {
    for (int j = -10; j <= 10; j++) {
      float fi = float(i);
      float fj = float(j);
      vec2 offset = texelSize * vec2(fi, fj) * radius;
      float weight = exp(-(fi * fi + fj * fj) / (2.0 * max(radius, 0.001) * max(radius, 0.001)));
      color += mix(getFromColor(uv + offset), getToColor(uv + offset), progress) * weight;
      total += weight;
    }
  }

  return color / total;
}
