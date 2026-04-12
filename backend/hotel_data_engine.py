import json
import requests
import pandas as pd
from datetime import datetime

class HotelDataEngine:
    def __init__(self, api_key: str, hotel_id: str):
        self.api_key = api_key
        self.hotel_id = hotel_id
        self.base_url = "https://api.easypms.com/v1" # Örnek URL

    def execute_dynamic_query(self, query_template: dict, start_date: str, end_date: str, parameters: list = None, measures: list = None):
        """
        İş Zekası (BI) Motoru: Dinamik sorgu şablonuna göre veri çeker ve hesaplanmış metrikleri uygular.
        """
        # 1. Payload Template'i al ve yer tutucuları (placeholders) değiştir
        payload_str = query_template.get("payload_template", "{}")
        payload_str = payload_str.replace("{{HOTEL_ID}}", str(self.hotel_id))
        payload_str = payload_str.replace("{{START_DATE}}", start_date)
        payload_str = payload_str.replace("{{END_DATE}}", end_date)
        
        try:
            # String'i JSON objesine çevir
            payload_params = json.loads(payload_str)
        except json.JSONDecodeError as e:
            print(f"JSON Parse Hatası (Payload Template geçersiz): {e}")
            return pd.DataFrame()

        # 2. API İsteği Gövdesini Hazırla
        api_request_body = {
            "Action": "Execute",
            "Object": query_template.get("api_object"),
            "Parameters": payload_params
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            # Gerçek senaryoda:
            # response = requests.post(f"{self.base_url}/data", json=api_request_body, headers=headers)
            # response.raise_for_status()
            # data = response.json() # Array of Arrays döner
            
            print(f"BI Motoru - API İsteği Atıldı:\n{json.dumps(api_request_body, indent=2)}")
            
            # Simülasyon: API'den dönen Array of Arrays yanıtı
            mock_api_response = [
                [ # 0. İndeks (Asıl Veri)
                    {"SALEDATE": start_date, "ROOMREVENUE": 15000, "ROOM": 180, "PAX": 200, "OCCUPANCY": 85.5},
                    {"SALEDATE": end_date, "ROOMREVENUE": 16000, "ROOM": 190, "PAX": 210, "OCCUPANCY": 90.0}
                ],
                [ # 1. İndeks (Özet/Meta Veri)
                    {"TOTAL_REVENUE": 31000, "TOTAL_ROOM": 370, "TOTAL_PAX": 410, "AVG_OCCUPANCY": 87.75}
                ]
            ]
            
            # 3. Response Index'e göre hedef diziyi seç
            res_index = query_template.get("response_index", 0)
            if res_index < len(mock_api_response):
                target_data = mock_api_response[res_index]
            else:
                target_data = []
            
            # 4. Pandas DataFrame'e çevir ve tipleri otomatik algıla
            df = pd.DataFrame(target_data)
            
            # Veri tiplerini otomatik dönüştür (sayıları int/float yapar)
            df = df.convert_dtypes()
            
            if df.empty:
                return df
                
            # 5. Parametreleri DataFrame'e ekle
            if parameters:
                for param in parameters:
                    # Parametre tipine göre dönüşüm
                    val = param.param_value
                    if param.param_type == 'number':
                        try:
                            val = float(val)
                        except ValueError:
                            pass
                    df[param.param_key] = val
                    
            # 6. Hesaplanmış Metrikleri (Calculated Measures) Uygula
            if measures:
                for measure in measures:
                    try:
                        # pandas.eval kullanarak formülü hesapla
                        # Örnek formül: (ROOM / ROOM_CAPACITY) * 100
                        # eval() DataFrame'in sütunlarını değişken olarak kullanabilir
                        df[measure.measure_name] = df.eval(measure.formula)
                    except Exception as eval_e:
                        print(f"Formül hesaplama hatası ({measure.measure_name}): {eval_e}")
                        df[measure.measure_name] = None
            
            return df
            
        except Exception as e:
            print(f"API Hatası: {e}")
            return pd.DataFrame()
