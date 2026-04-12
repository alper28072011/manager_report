from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./hotel_reports.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Hotel(Base):
    __tablename__ = "hotels"
    id = Column(Integer, primary_key=True, index=True)
    hotel_code = Column(String, unique=True, index=True)
    hotel_name = Column(String)
    api_key = Column(String)
    created_at = Column(Date, default=datetime.utcnow)
    
    budgets = relationship("BudgetTarget", back_populates="hotel", cascade="all, delete-orphan")
    queries = relationship("QueryTemplate", back_populates="hotel", cascade="all, delete-orphan")

class BudgetTarget(Base):
    __tablename__ = "budget_targets"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    target_date = Column(Date)
    target_room_revenue = Column(Float)
    target_pax = Column(Integer)
    target_occupancy_rate = Column(Float)
    
    hotel = relationship("Hotel", back_populates="budgets")
    __table_args__ = (UniqueConstraint('hotel_id', 'target_date', name='_hotel_date_uc'),)

class QueryTemplate(Base):
    __tablename__ = "query_templates"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    query_name = Column(String)
    api_object = Column(String)
    payload_template = Column(String) # JSON formatında metin, dinamik yer tutucular içerir
    response_index = Column(Integer, default=0) # API'den dönen diziler içindeki hedef indeks
    is_active = Column(Boolean, default=True)
    
    hotel = relationship("Hotel", back_populates="queries")

class HotelParameter(Base):
    __tablename__ = "hotel_parameters"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    param_key = Column(String)
    param_value = Column(String)
    param_type = Column(String) # number, date, text
    
    hotel = relationship("Hotel")

class CalculatedMeasure(Base):
    __tablename__ = "calculated_measures"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    measure_name = Column(String)
    formula = Column(String)
    format_type = Column(String) # percentage, currency, number
    
    hotel = relationship("Hotel")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
