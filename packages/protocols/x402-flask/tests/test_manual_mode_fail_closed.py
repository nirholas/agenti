import unittest
from unittest import mock

from flask import Flask, jsonify

from openclaw_x402.middleware import X402Middleware
import openclaw_x402.middleware as middleware_module


def create_test_app():
    app = Flask(__name__)
    x402 = X402Middleware(app, treasury="0xdeadbeef")

    @app.route("/premium")
    @x402.premium(price="1000", description="Premium endpoint")
    def premium_endpoint():
        return jsonify({"ok": True})

    @app.route("/free")
    @x402.premium(price="0", description="Free endpoint")
    def free_endpoint():
        return jsonify({"ok": True})

    return app


class ManualModeFailClosedTests(unittest.TestCase):
    def setUp(self):
        app = create_test_app()
        self.client = app.test_client()

    @mock.patch.object(middleware_module, "X402_LIB_AVAILABLE", False)
    def test_paid_route_without_header_returns_402(self):
        response = self.client.get("/premium")
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.get_json()["error"], "Payment Required")

    @mock.patch.object(middleware_module, "X402_LIB_AVAILABLE", False)
    def test_paid_route_with_fake_header_still_returns_402(self):
        response = self.client.get(
            "/premium",
            headers={"X-PAYMENT": "totally-fake-token"},
        )
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.get_json()["error"], "Payment Required")

    @mock.patch.object(middleware_module, "X402_LIB_AVAILABLE", False)
    def test_free_route_remains_accessible_in_manual_mode(self):
        response = self.client.get(
            "/free",
            headers={"X-PAYMENT": "totally-fake-token"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"ok": True})


if __name__ == "__main__":
    unittest.main()
