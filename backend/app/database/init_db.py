from app.database.session import engine, Base
from app.database import models
from app.core.security import get_password_hash
from app.database.session import SessionLocal

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Check if default admin exists, if not create
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            admin_user = models.User(
                username="admin",
                email="admin@exaplan.edu",
                hashed_password=get_password_hash("admin123"),
                role=models.UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Default admin created: admin / admin123")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
