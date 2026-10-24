"""Tiny synthetic fixtures verify masks/denominators; no network or real forest data."""
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from pyproj import Transformer
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import Polygon, box, mapping
from shapely.ops import transform

from summarize_rasters import summarize

SINUSOIDAL = "+proj=sinu +R=6371007.181 +units=m +no_defs"


class StatisticsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.lc = self.root / "MCD12Q1.061_LC_Type1_2020.tif"
        self.boundary = self.root / "boundary.geojson"

    def tearDown(self):
        self.temp.cleanup()

    def fixture(self, values, boundary=None, crs=SINUSOIDAL):
        values = np.asarray(values, dtype="uint8")
        height, width = values.shape
        with rasterio.open(self.lc, "w", driver="GTiff", count=1, dtype="uint8",
                           width=width, height=height, crs=crs, nodata=255,
                           transform=from_origin(0, height * 1000, 1000, 1000)) as dataset:
            dataset.write(values, 1)
        projected = boundary if boundary is not None else box(1, 1, width * 1000 - 1, height * 1000 - 1)
        geographic = transform(Transformer.from_crs(SINUSOIDAL, "EPSG:4326", always_xy=True).transform,
                              projected)
        self.boundary.write_text(json.dumps(mapping(geographic)), encoding="utf-8")

    def test_forest_land_water_counts_and_equal_area(self):
        self.fixture([[1, 5, 6], [16, 17, 12]])
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result["forest_area_km2"], 2)
        self.assertEqual(result["valid_land_area_km2"], 5)
        self.assertEqual(result["water_area_km2"], 1)
        self.assertEqual(result["forest_share_of_valid_land_pct"], 40)
        self.assertEqual(result["valid_classified_area_fraction"], 1)

    def test_nodata_suppresses_headline_without_treating_missing_as_nonforest(self):
        self.fixture([[1, 255], [16, 17]])
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result["status"], "insufficient_coverage")
        self.assertIsNone(result["forest_share_of_valid_land_pct"])
        self.assertEqual(result["diagnostics"]["observed_forest_share_of_valid_land_pct"], 50)
        self.assertEqual(result["nodata_count"], 1)
        self.assertEqual(result["valid_classified_area_fraction"], .75)

    def test_boundary_mask_excludes_nonforest_outside_polygon(self):
        self.fixture([[1, 16], [5, 16]], box(1, 1, 999, 1999))
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result["boundary_pixel_area_km2"], 2)
        self.assertEqual(result["forest_share_of_valid_land_pct"], 100)

    def test_region_in_later_block_retains_exact_pixel_centres(self):
        values = np.full((520, 520), 16, dtype='uint8')
        values[0:2, 513:515] = 1
        self.fixture(values, box(513001, 518001, 514999, 519999))
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result['pixel_counts']['boundary'], 4)
        self.assertEqual(result['pixel_counts']['forest'], 4)

    def test_hole_excluded_from_denominator(self):
        outer = box(1, 1, 2999, 2999)
        polygon = Polygon(outer.exterior.coords, [box(1001, 1001, 1999, 1999).exterior.coords])
        self.fixture([[1, 1, 1], [1, 16, 1], [1, 1, 1]], polygon)
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result["boundary_pixel_area_km2"], 8)
        self.assertEqual(result["forest_share_of_valid_land_pct"], 100)

    def test_invalid_category_not_land(self):
        self.fixture([[1, 0], [254, 17]])
        result = summarize(self.lc, self.boundary, 2020)
        self.assertEqual(result["invalid_class_count"], 2)
        self.assertEqual(result["valid_land_area_km2"], 1)
        self.assertEqual(result["valid_classified_area_fraction"], .5)
        self.assertIsNone(result["forest_share_of_valid_land_pct"])

    def test_water_only_has_no_rate(self):
        self.fixture([[17, 17]])
        result = summarize(self.lc, self.boundary, 2020)
        self.assertIsNone(result["forest_share_of_valid_land_pct"])
        self.assertIsNone(result["diagnostics"]["observed_forest_share_of_valid_land_pct"])

    def test_partial_tile_refused(self):
        self.fixture([[1, 1]], box(1, 1, 3999, 999))
        with self.assertRaisesRegex(ValueError, "full boundary"):
            summarize(self.lc, self.boundary, 2020)

    def test_geographic_raster_refused(self):
        self.fixture([[1, 1]], crs="EPSG:4326")
        with self.assertRaisesRegex(ValueError, "native MODIS"):
            summarize(self.lc, self.boundary, 2020)

    def test_qc_unclassified_barren_is_missing_not_valid_land(self):
        self.fixture([[1, 16], [5, 17]])
        qc = self.root / 'QC.tif'
        with rasterio.open(self.lc) as source:
            profile = source.profile
        with rasterio.open(qc, 'w', **profile) as target:
            target.write(np.array([[0, 1], [8, 2]], dtype='uint8'), 1)
        result = summarize(self.lc, self.boundary, 2020, qc)
        self.assertEqual(result['pixel_counts']['qc_rejected'], 1)
        self.assertEqual(result['pixel_counts']['qc_backfilled'], 1)
        self.assertEqual(result['valid_land_area_km2'], 2)
        self.assertEqual(result['valid_classified_area_fraction'], .75)
        self.assertIsNone(result['forest_share_of_valid_classified_area_pct'])
        self.assertTrue(result['quality_control_applied'])


if __name__ == "__main__":
    unittest.main()
