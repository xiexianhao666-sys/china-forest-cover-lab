import hashlib
from pathlib import Path
import tempfile
import unittest
from download_task import safe_path, verified

class DownloadTests(unittest.TestCase):
    def test_traversal(self):
        root = Path(tempfile.gettempdir()) / 'bundle-test'
        for name in ['../escape', '/absolute', 'C:/absolute', 'x\\..\\escape']:
            with self.assertRaises(ValueError):
                safe_path(root, name)
        self.assertEqual(safe_path(root, 'folder/file.tif'), root.resolve() / 'folder/file.tif')

    def test_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'sample'
            file.write_bytes(b'abc')
            item = {'file_size': 3, 'sha256': hashlib.sha256(b'abc').hexdigest()}
            self.assertTrue(verified(file, item))
            file.write_bytes(b'abd')
            self.assertFalse(verified(file, item))

if __name__ == '__main__':
    unittest.main()
