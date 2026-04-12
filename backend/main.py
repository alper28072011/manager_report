from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db, Hotel, QueryTemplate, HotelParameter, CalculatedMeasure
from hotel_data_engine import HotelDataEngine

app = FastAPI(title="Hotel SaaS API")

# Pydantic Modelleri
class QueryTemplateBase(BaseModel):
    query_name: str
    api_object: str
    columns_grouped: str
    columns_summed: str
    is_active: bool = True

class QueryTemplateCreate(QueryTemplateBase):
    pass

class QueryTemplateUpdate(QueryTemplateBase):
    pass

class QueryTemplateResponse(QueryTemplateBase):
    id: int
    hotel_id: int
    class Config:
        orm_mode = True

class HotelParameterBase(BaseModel):
    param_key: str
    param_value: str
    param_type: str

class HotelParameterCreate(HotelParameterBase):
    pass

class HotelParameterResponse(HotelParameterBase):
    id: int
    hotel_id: int
    class Config:
        orm_mode = True

class CalculatedMeasureBase(BaseModel):
    measure_name: str
    formula: str
    format_type: str

class CalculatedMeasureCreate(CalculatedMeasureBase):
    pass

class CalculatedMeasureResponse(CalculatedMeasureBase):
    id: int
    hotel_id: int
    class Config:
        orm_mode = True

# Endpoint'ler

@app.get("/api/hotels/{hotel_id}/queries", response_model=List[QueryTemplateResponse])
def get_queries(hotel_id: int, db: Session = Depends(get_db)):
    queries = db.query(QueryTemplate).filter(QueryTemplate.hotel_id == hotel_id).all()
    return queries

@app.post("/api/hotels/{hotel_id}/queries", response_model=QueryTemplateResponse)
def create_query(hotel_id: int, query: QueryTemplateCreate, db: Session = Depends(get_db)):
    # Otel var mı kontrolü eklenebilir
    db_query = QueryTemplate(**query.dict(), hotel_id=hotel_id)
    db.add(db_query)
    db.commit()
    db.refresh(db_query)
    return db_query

@app.put("/api/hotels/{hotel_id}/queries/{query_id}", response_model=QueryTemplateResponse)
def update_query(hotel_id: int, query_id: int, query: QueryTemplateUpdate, db: Session = Depends(get_db)):
    db_query = db.query(QueryTemplate).filter(QueryTemplate.id == query_id, QueryTemplate.hotel_id == hotel_id).first()
    if not db_query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    for key, value in query.dict().items():
        setattr(db_query, key, value)
        
    db.commit()
    db.refresh(db_query)
    return db_query

@app.delete("/api/hotels/{hotel_id}/queries/{query_id}")
def delete_query(hotel_id: int, query_id: int, db: Session = Depends(get_db)):
    db_query = db.query(QueryTemplate).filter(QueryTemplate.id == query_id, QueryTemplate.hotel_id == hotel_id).first()
    if not db_query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    db.delete(db_query)
    db.commit()
    return {"message": "Query deleted successfully"}

# Hotel Parameter Endpoints

@app.get("/api/hotels/{hotel_id}/parameters", response_model=List[HotelParameterResponse])
def get_parameters(hotel_id: int, db: Session = Depends(get_db)):
    return db.query(HotelParameter).filter(HotelParameter.hotel_id == hotel_id).all()

@app.post("/api/hotels/{hotel_id}/parameters", response_model=HotelParameterResponse)
def create_parameter(hotel_id: int, param: HotelParameterCreate, db: Session = Depends(get_db)):
    db_param = HotelParameter(**param.dict(), hotel_id=hotel_id)
    db.add(db_param)
    db.commit()
    db.refresh(db_param)
    return db_param

@app.delete("/api/hotels/{hotel_id}/parameters/{param_id}")
def delete_parameter(hotel_id: int, param_id: int, db: Session = Depends(get_db)):
    db_param = db.query(HotelParameter).filter(HotelParameter.id == param_id, HotelParameter.hotel_id == hotel_id).first()
    if not db_param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    db.delete(db_param)
    db.commit()
    return {"message": "Parameter deleted successfully"}

# Calculated Measure Endpoints

@app.get("/api/hotels/{hotel_id}/measures", response_model=List[CalculatedMeasureResponse])
def get_measures(hotel_id: int, db: Session = Depends(get_db)):
    return db.query(CalculatedMeasure).filter(CalculatedMeasure.hotel_id == hotel_id).all()

@app.post("/api/hotels/{hotel_id}/measures", response_model=CalculatedMeasureResponse)
def create_measure(hotel_id: int, measure: CalculatedMeasureCreate, db: Session = Depends(get_db)):
    db_measure = CalculatedMeasure(**measure.dict(), hotel_id=hotel_id)
    db.add(db_measure)
    db.commit()
    db.refresh(db_measure)
    return db_measure

@app.delete("/api/hotels/{hotel_id}/measures/{measure_id}")
def delete_measure(hotel_id: int, measure_id: int, db: Session = Depends(get_db)):
    db_measure = db.query(CalculatedMeasure).filter(CalculatedMeasure.id == measure_id, CalculatedMeasure.hotel_id == hotel_id).first()
    if not db_measure:
        raise HTTPException(status_code=404, detail="Measure not found")
    db.delete(db_measure)
    db.commit()
    return {"message": "Measure deleted successfully"}

# Dinamik Veri Çekme Örneği
@app.get("/api/reports/{hotel_id}/dynamic-data/{query_id}")
def get_dynamic_report(hotel_id: int, query_id: int, from_date: str, to_date: str, db: Session = Depends(get_db)):
    hotel = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    query_template = db.query(QueryTemplate).filter(QueryTemplate.id == query_id, QueryTemplate.hotel_id == hotel_id).first()
    if not query_template:
        raise HTTPException(status_code=404, detail="Query template not found")
        
    # Otel parametreleri ve metriklerini çek
    parameters = db.query(HotelParameter).filter(HotelParameter.hotel_id == hotel_id).all()
    measures = db.query(CalculatedMeasure).filter(CalculatedMeasure.hotel_id == hotel_id).all()
    
    engine = HotelDataEngine(api_key=hotel.api_key, hotel_id=hotel.hotel_code)
    
    # QueryTemplate nesnesini dict'e çevir
    template_dict = {
        "api_object": query_template.api_object,
        "columns_grouped": query_template.columns_grouped,
        "columns_summed": query_template.columns_summed
    }
    
    df = engine.execute_dynamic_query(template_dict, from_date, to_date, parameters, measures)
    
    return df.to_dict(orient="records")
