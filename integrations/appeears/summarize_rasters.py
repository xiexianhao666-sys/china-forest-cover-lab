"""Exploratory, boundary-masked MCD12Q1.061 LC_Type1 area accounting.

Requires one complete, native MODIS sinusoidal GeoTIFF for one year.
This is a classified-land proportion, NOT China's official forest coverage rate.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import warnings

import numpy as np
from pyproj import CRS, Transformer
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

PRODUCT = "MCD12Q1.061"
MIN_VALID_FRACTION = 0.99
MODIS_RADIUS = 6371007.181
GUIDE = "https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf"


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_boundary(path: Path):
    doc = json.loads(path.read_text(encoding="utf-8-sig"))
    declared = doc.get("crs", {}).get("properties", {}).get("name")
    if declared and not CRS.from_user_input(declared).equals(CRS.from_epsg(4326), ignore_axis_order=True):
        raise ValueError("Boundary must use WGS84 longitude/latitude (EPSG:4326/CRS84).")
    if doc.get("type") == "FeatureCollection":
        geometries = [feature.get("geometry") for feature in doc.get("features", [])]
    elif doc.get("type") == "Feature":
        geometries = [doc.get("geometry")]
    else:
        geometries = [doc]
    polygons = []
    for item in geometries:
        if not item or item.get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError("Boundary must contain only nonempty Polygon/MultiPolygon geometries.")
        geometry = shape(item)
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError("Invalid/empty boundary; repair and review it before statistics.")
        minx, miny, maxx, maxy = geometry.bounds
        if not (-180 <= minx < maxx <= 180 and -90 <= miny < maxy <= 90):
            raise ValueError("Boundary coordinates are outside longitude/latitude ranges.")
        polygons.append(geometry)
    if not polygons:
        raise ValueError("Boundary has no polygons.")
    return unary_union(polygons)


def _validated_crs(crs) -> CRS:
    if crs is None:
        raise ValueError("Raster CRS is missing.")
    result = CRS.from_user_input(crs)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        parameters = result.to_dict()
    if (not result.is_projected or parameters.get("proj") != "sinu"
            or not result.axis_info
            or any(abs(axis.unit_conversion_factor - 1.0) > 1e-12 for axis in result.axis_info)
            or abs(result.ellipsoid.semi_major_metre - MODIS_RADIUS) > 0.01
            or abs(result.ellipsoid.semi_minor_metre - MODIS_RADIUS) > 0.01):
        raise ValueError("Require native MODIS Sinusoidal in metres on the 6371007.181 m sphere; do not count geographic-degree pixels as area.")
    return result


def summarize(lc: str | Path, boundary: str | Path, year: int, qc: str | Path | None = None) -> dict:
    """Stream one raster, suppressing the headline when missing/invalid area >1%."""
    lc, boundary = Path(lc).resolve(), Path(boundary).resolve()
    if not lc.is_file() or lc.suffix.lower() not in (".tif", ".tiff"):
        raise ValueError("--lc must be one GeoTIFF file. Multiple tiles must be mosaicked without overlap first.")
    if not 2001 <= year <= datetime.now(timezone.utc).year:
        raise ValueError("Year must be a released MCD12Q1 year from 2001 onward; verify the filename and AppEEARS manifest.")
    geographic = _read_boundary(boundary)
    counts = {"boundary": 0, "forest": 0, "valid_land": 0, "water": 0,
              "nodata": 0, "invalid_class": 0, "qc_rejected": 0, "qc_backfilled": 0, "qc_climate_adjusted": 0}
    classes = {str(code): 0 for code in range(1, 18)}
    with ExitStack() as stack:
        dataset = stack.enter_context(rasterio.open(lc))
        quality = stack.enter_context(rasterio.open(qc)) if qc else None
        if quality and (quality.count != 1 or quality.crs != dataset.crs or quality.transform != dataset.transform or quality.shape != dataset.shape):
            raise ValueError("QC must have exactly the same CRS, transform and shape as LC_Type1.")
        if dataset.driver != "GTiff" or dataset.count != 1 or dataset.subdatasets:
            raise ValueError("Require one single-band GeoTIFF for LC_Type1 and exactly one year.")
        if not np.issubdtype(np.dtype(dataset.dtypes[0]), np.integer):
            raise ValueError("LC_Type1 must be integer categories; interpolation/resampling of classes is not accepted.")
        crs = _validated_crs(dataset.crs)
        affine = dataset.transform
        pixel_area = abs(affine.a * affine.e - affine.b * affine.d)
        if not np.isfinite(pixel_area) or pixel_area <= 0:
            raise ValueError("Raster has an invalid pixel-area transform.")
        projected = transform(Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform,
                              geographic.segmentize(0.05))
        footprint = Polygon([affine * (0, 0), affine * (dataset.width, 0),
                             affine * (dataset.width, dataset.height), affine * (0, dataset.height)])
        # Deliberately reject partial tiles: valid pixels in one tile are not national coverage.
        if not footprint.buffer(1e-5).covers(projected):
            raise ValueError("Raster footprint does not cover the full boundary. Mosaic all tiles into one aligned raster first; partial statistics are refused.")
        projected_mapping = mapping(projected)
        # Fixed bounded windows also protect against a GeoTIFF stored as one huge strip.
        for row in range(0, dataset.height, 512):
            for col in range(0, dataset.width, 512):
                window = Window(col, row, min(512, dataset.width - col), min(512, dataset.height - row))
                window_transform = dataset.window_transform(window)
                window_shape = (int(window.height), int(window.width))
                inside = geometry_mask([projected_mapping], out_shape=window_shape,
                                       transform=window_transform, invert=True, all_touched=False)
                n_inside = int(np.count_nonzero(inside))
                if not n_inside:
                    continue
                data = dataset.read(1, window=window, masked=True)
                values = data.data
                nodata = inside & (np.ma.getmaskarray(data) | (values == 255))
                classified = inside & ~nodata & (values >= 1) & (values <= 17)
                if quality:
                    q = quality.read(1, window=window, masked=True)
                    accepted = ~np.ma.getmaskarray(q) & np.isin(q.data, [0, 2, 4, 5, 6, 7, 8, 9])
                    counts["qc_rejected"] += int(np.count_nonzero(classified & ~accepted))
                    classified &= accepted
                    counts["qc_backfilled"] += int(np.count_nonzero(classified & (q.data == 8)))
                    counts["qc_climate_adjusted"] += int(np.count_nonzero(classified & (q.data == 9)))
                land = classified & (values <= 16)
                counts["boundary"] += n_inside
                counts["nodata"] += int(np.count_nonzero(nodata))
                counts["forest"] += int(np.count_nonzero(land & (values <= 5)))
                counts["valid_land"] += int(np.count_nonzero(land))
                counts["water"] += int(np.count_nonzero(classified & (values == 17)))
                counts["invalid_class"] += int(np.count_nonzero(inside & ~nodata & ((values < 1) | (values > 17))))
                frequencies = np.bincount(values[classified].astype(np.int64), minlength=18)
                for code in range(1, 18):
                    classes[str(code)] += int(frequencies[code])
        source_crs = crs.to_wkt()
        source_shape = [dataset.height, dataset.width]
    if not counts["boundary"]:
        raise ValueError("Boundary contains no pixel centres at this resolution.")
    coverage = (counts["valid_land"] + counts["water"]) / counts["boundary"]
    diagnostic_share = (100.0 * counts["forest"] / counts["valid_land"]
                        if counts["valid_land"] else None)
    usable = coverage >= MIN_VALID_FRACTION and diagnostic_share is not None
    area = lambda count: count * pixel_area / 1_000_000
    return {
        "schema_version": 1, "product": PRODUCT, "layer": "LC_Type1", "year": year,
        "status": "exploratory_estimate" if usable else "insufficient_coverage",
        "is_official_forest_coverage": False, "quality_control_applied": qc is not None,
        "forest_area_km2": area(counts["forest"]),
        "valid_land_area_km2": area(counts["valid_land"]),
        "water_area_km2": area(counts["water"]),
        "boundary_pixel_area_km2": area(counts["boundary"]),
        "forest_share_of_valid_land_pct": diagnostic_share if usable else None,
        "forest_share_of_valid_classified_area_pct": 100 * counts["forest"] / (counts["valid_land"] + counts["water"]) if usable else None,
        "observed_forest_fraction_of_boundary_pct_lower_bound": 100 * counts["forest"] / counts["boundary"],
        "valid_classified_area_fraction": coverage,
        "minimum_valid_classified_area_fraction": MIN_VALID_FRACTION,
        "nodata_count": counts["nodata"], "invalid_class_count": counts["invalid_class"],
        "pixel_counts": counts, "class_pixel_counts": classes,
        "diagnostics": {"observed_forest_share_of_valid_land_pct": diagnostic_share,
                        "boundary_vector_area_km2": projected.area / 1_000_000,
                        "pixel_area_m2": pixel_area, "raster_shape": source_shape},
        "method": {"forest_classes": [1, 2, 3, 4, 5], "land_classes": list(range(1, 17)),
                   "water_classes": [17], "fill_values": [255], "boundary_rule": "pixel centre",
                   "area_method": "absolute affine determinant in native equal-area MODIS Sinusoidal metres",
                   "denominators": {"forest_share_of_valid_land_pct": "QC-accepted LC_Type1 classes 1..16; excludes water and missing",
                                    "forest_share_of_valid_classified_area_pct": "QC-accepted LC_Type1 classes 1..17; includes water, excludes missing",
                                    "valid_classified_area_fraction": "all pixel centres within fixed boundary, including missing"},
                   "accepted_qc_codes": [0, 2, 4, 5, 6, 7, 8, 9] if qc else None},
        "limitations": [
            "Exploratory classified-land estimate; not the official Chinese forest coverage definition.",
            "Valid-class coverage is data completeness, not classification accuracy. QC screened when supplied; LW not used to change labels.",
            "Unknown/missing pixels are not nonforest. Area totals include observed pixels only.",
            "Pixel-centre boundary inclusion approximates edge area; small islands narrower than a pixel may be omitted.",
            "Supplied boundary provenance/territorial completeness and raster product/year must be checked against the download manifest.",
            "Year-to-year class differences alone do not establish genuine forest gain/loss; classification uncertainty requires validation."
        ],
        "sources": {"lc_path": str(lc), "qc_path": str(Path(qc).resolve()) if qc else None, "boundary_path": str(boundary),
                    "boundary_sha256": _hash_file(boundary), "crs_wkt": source_crs,
                    "product_doi": "https://doi.org/10.5067/MODIS/MCD12Q1.061", "user_guide": GUIDE},
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lc", required=True, type=Path, help="One complete single-band LC_Type1 GeoTIFF")
    parser.add_argument("--boundary", required=True, type=Path, help="WGS84 polygon GeoJSON")
    parser.add_argument("--qc", required=True, type=Path, help="Aligned QC GeoTIFF; rejected codes 1,3,10,255 and unknown")
    parser.add_argument("--year", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.resolve() in (args.lc.resolve(), args.qc.resolve(), args.boundary.resolve()):
        parser.error("Output must not overwrite either input.")
    try:
        result = summarize(args.lc, args.boundary, args.year, args.qc)
    except (ValueError, OSError, rasterio.errors.RasterioError) as error:
        parser.exit(2, f"Statistics refused: {error}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(args.output)
    print(json.dumps({"status": result["status"], "year": args.year, "output": str(args.output.resolve()),
                      "valid_classified_area_fraction": result["valid_classified_area_fraction"],
                      "forest_share_of_valid_land_pct": result["forest_share_of_valid_land_pct"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
