import { CHINA_GEOJSON } from "./china-data.js";
export { CHINA_GEOJSON };
export const features = CHINA_GEOJSON.features.filter(
  (f) => f.properties.name && f.geometry,
);
function project(p) {
  return [(p[0] - 72) * 10, (55 - p[1]) * 12];
}
function path(g) {
  const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  return polys
    .map((poly) =>
      poly
        .map(
          (r) =>
            r
              .map(
                (p, i) =>
                  (i ? "L" : "M") +
                  project(p)
                    .map((n) => n.toFixed(1))
                    .join(","),
              )
              .join("") + "Z",
        )
        .join(""),
    )
    .join("");
}
const labelPositions = {
  130000: [116.3, 39.2],
  140000: [112.4, 37.7],
  320000: [120.1, 33.6],
  340000: [116.9, 31.7],
  620000: [104.0, 36.9],
  630000: [96.0, 35.5],
};
function graticule() {
  let s =
    '<rect x="0" y="0" width="650" height="480" fill="#fafbfc" stroke="#bdc8d0" stroke-width=".6"/>';
  for (let lon = 80; lon <= 130; lon += 10) {
    const x = project([lon, 55])[0];
    s +=
      '<line x1="' +
      x +
      '" x2="' +
      x +
      '" y1="0" y2="480" stroke="#dce1e5" stroke-width=".6"/><text x="' +
      x +
      '" y="497" text-anchor="middle" font-size="10" fill="#7c8993">' +
      lon +
      "°E</text>";
  }
  for (let lat = 20; lat <= 50; lat += 10) {
    const y = project([72, lat])[1];
    s +=
      '<line x1="0" x2="650" y1="' +
      y +
      '" y2="' +
      y +
      '" stroke="#dce1e5" stroke-width=".6"/><text x="-8" y="' +
      (y + 3) +
      '" text-anchor="end" font-size="10" fill="#7c8993">' +
      lat +
      "°N</text>";
  }
  return s;
}

export { project, path, labelPositions, graticule };
export function boundaryMap() {
  const polygons = features
    .map(
      (f) =>
        '<path class="province" d="' +
        path(f.geometry) +
        '" fill="#e0e6ea" stroke="#798887" stroke-width=".35"/>',
    )
    .join("");
  const labels = features
    .filter(
      (f) =>
        f.properties.center &&
        ![110000, 120000, 310000, 810000, 820000].includes(f.properties.adcode),
    )
    .map((f) => {
      const p = project(
        labelPositions[f.properties.adcode] || f.properties.center,
      );
      return (
        '<text class="province-label" text-anchor="middle" x="' +
        p[0] +
        '" y="' +
        p[1] +
        '">' +
        f.properties.name.replace(
          /特别行政区|自治区|维吾尔|壮族|回族|省|市/g,
          "",
        ) +
        "</text>"
      );
    })
    .join("");
  const inset = CHINA_GEOJSON.features
    .filter((f) => f.geometry)
    .map(
      (f) =>
        '<path d="' +
        path(f.geometry) +
        '" fill="#e0e6ea" stroke="white" stroke-width=".3"/>',
    )
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -12 714 523" role="img" aria-label="研究范围示意"><title>研究范围示意，非统计图层</title>' +
    graticule() +
    '<defs><clipPath id="boundaryClip"><rect x="0" y="0" width="650" height="480"/></clipPath></defs><g clip-path="url(#boundaryClip)">' +
    polygons +
    labels +
    '</g><svg x="548" y="321" width="90" height="133" viewBox="315 360 220 280" preserveAspectRatio="none"><rect x="315" y="360" width="220" height="280" fill="white"/>' +
    inset +
    '</svg><rect x="548" y="321" width="90" height="133" fill="none" stroke="#8d9ba5" stroke-width=".7"/><text x="593" y="468" text-anchor="middle" font-size="10" fill="#667580">南海诸岛</text></svg>'
  );
}
