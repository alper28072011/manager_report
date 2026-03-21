from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db, Hotel, QueryTemplate
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

# Dinamik Veri Çekme Örneği
@app.get("/api/reports/{hotel_id}/dynamic-data/{query_id}")
def get_dynamic_report(hotel_id: int, query_id: int, from_date: str, to_date: str, db: Session = Depends(get_db)):
    hotel = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    query_template = db.query(QueryTemplate).filter(QueryTemplate.id == query_id, QueryTemplate.hotel_id == hotel_id).first()
    if not query_template:
        raise HTTPException(status_code=404, detail="Query template not found")
        
    engine = HotelDataEngine(api_key=hotel.api_key, hotel_id=hotel.hotel_code)
    
    # QueryTemplate nesnesini dict'e çevir
    template_dict = {
        "api_object": query_template.api_object,
        "columns_grouped": query_template.columns_grouped,
        "columns_summed": query_template.columns_summed
    }
    
    df = engine.get_dynamic_data(from_date, to_date, template_dict)
    
    return df.to_dict(orient="records")
