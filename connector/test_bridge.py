# Testes sem rede do formato de velas; não realiza login.
import unittest
from unittest.mock import patch
from iq_readonly_bridge import convert

class CandleValidationTests(unittest.TestCase):
    def test_only_closed_minute_candles(self):
        now=1800000120
        records=[
            {"from":1800000000,"open":1.0,"max":1.2,"min":.9,"close":1.1},
            {"from":1800000060,"open":1.1,"max":1.3,"min":1.0,"close":1.2},
            {"from":1800000120,"open":1.2,"max":1.3,"min":1.1,"close":1.25},
        ]
        self.assertEqual([x["t"] for x in convert(records,now)],[1800000000,1800000060])
    def test_reject_invalid_ohlc(self):
        now=1800000120
        records=[{"from":1800000000,"open":1.3,"max":1.1,"min":.9,"close":1.1}]
        self.assertEqual(convert(records,now),[])
    def test_no_orders_or_credentials(self):
        import inspect
        import iq_readonly_bridge
        content=inspect.getsource(iq_readonly_bridge)
        self.assertNotIn("api.buy(",content)
        self.assertNotIn("api.sell(",content)
if __name__=="__main__":
    unittest.main()
