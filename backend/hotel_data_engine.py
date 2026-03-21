import requests
import pandas as pd
from datetime import datetime

class HotelDataEngine:
    def __init__(self, api_key: str, hotel_id: str):
        self.api_key = api_key
        self.hotel_id = hotel_id
        self.base_url = "https://api.easypms.com/v1" # Örnek URL

    def get_dynamic_data(self, from_date: str, to_date: str, query_template: dict):
        """
        Dinamik sorgu şablonuna göre veri çeker.
        """
        payload = {
            "Action": "Execute",
            "Object": query_template["api_object"],
            "Parameters": {
                "HOTELID": self.hotel_id,
                "FROMDATE": from_date,
                "TODATE": to_date,
                "COLUMNSGROUPED": query_template["columns_grouped"],
                "COLUMNSSUMMED": query_template["columns_summed"]
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            # Gerçek senaryoda:
            # response = requests.post(f"{self.base_url}/data", json=payload, headers=headers)
            # response.raise_for_status()
            # data = response.json()
            
            # Simülasyon için mock veri döndürüyoruz
            print(f"API İsteği Atıldı: {payload}")
            
            # Pandas DataFrame'e çevirme simülasyonu
            mock_data = [
                {"SALEDATE": from_date, "ROOMREVENUE": 15000, "PAX": 200},
                {"SALEDATE": to_date, "ROOMREVENUE": 16000, "PAX": 210}
            ]
            df = pd.DataFrame(mock_data)
            return df
            
        except requests.exceptions.RequestException as e:
            print(f"API Hatası: {e}")
            return pd.DataFrame()
