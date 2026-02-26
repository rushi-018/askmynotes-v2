from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import os

# 1. Load environment variables BEFORE importing routers
load_dotenv()

# 2. Import database and models
from database.postgresConn import engine, Base
from models import all_model

# 3. Create tables in the new Supabase instance
all_model.Base.metadata.create_all(bind=engine)

# 4. Initialize App
app = FastAPI(title="AskMyNotes")

# 5. Secure Session Middleware
# Ensure SESSION_SECRET is set in your .env
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SESSION_SECRET", "super-secret-fallback-key-use-env-instead"),
    same_site="lax",
    https_only=False  # Set to True in production with SSL
)

# 6. CORS Configuration
origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 7. Include Routers
from router import user_routes, auth_routes, chatbot_routes
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(chatbot_routes.router)

@app.get("/")
def root():
    return {"message": "Welcome to AskMyNotes!"}