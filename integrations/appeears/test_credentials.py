import tempfile
import unittest
import os
from pathlib import Path
from credential_store import crypt, read_token, write_token

@unittest.skipUnless(os.name == 'nt', 'DPAPI credential cache requires Windows')
class CredentialTests(unittest.TestCase):
    def test_encrypted_roundtrip_and_expiry(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "test.dpapi"
            value = "dummy-test-value-not-a-real-credential"
            write_token(value, "2099-01-01T00:00:00Z", path)
            self.assertNotIn(value.encode(), path.read_bytes())
            self.assertEqual(read_token(path), value)
            write_token(value, "2000-01-01T00:00:00Z", path)
            self.assertIsNone(read_token(path))
    def test_tampered_data_rejected(self):
        with self.assertRaises(RuntimeError):
            crypt(b"not-valid-encrypted-data", decrypt=True)

if __name__ == "__main__":
    unittest.main()
