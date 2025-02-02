from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from pymongo import MongoClient
import bcrypt
import os
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
import asyncio
from run_predictionFINAL import predict_safety, get_filtered_nearby_places

# Load environment variables
load_dotenv()

account_sid = os.getenv("ACCOUNT_SID")
auth_token = os.getenv("AUTH_TOKEN")
twilio_number = "+18447570192"
recipient_number = "+12676157773"  # Recipient's number

# Connect to MongoDB
MONGO_URI = "mongodb://localhost:27017"
client = MongoClient(MONGO_URI)
db = client["user_password"]
collection = db["users"]  # Store user information

# Retrieve stored SERVER_KEY hash value
SERVER_KEY_HASH = os.getenv("SERVER_KEY_HASH")


# Request data model
class PasswordRequest(BaseModel):
    uuid: str
    password: str

class uuidRequest(BaseModel):
    uuid: str

class addressRequest(BaseModel):
    uuid: str
    address: str

class predictRequest(BaseModel):
    uuid: str
    latitude: float
    longitude: float

# Dependency: Check API key
def check_auth(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=403, detail="Missing Authorization header")

    # Validate hashed API key
    if not bcrypt.checkpw(authorization.encode(), SERVER_KEY_HASH.encode()):
        raise HTTPException(status_code=403, detail="Unauthorized")


# FastAPI instance
app = FastAPI()


# **Set Password**
@app.post("/v1/setpasswd")
def set_password(request: PasswordRequest, auth: str = Depends(check_auth)):
    uuid = request.uuid
    password = request.password

    # Generate hashed password
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode(), salt)

    # Check if the device already exists
    existing_user = collection.find_one({"uuid": uuid})

    if existing_user:
        # Update password
        collection.update_one({"uuid": uuid}, {"$set": {"password": hashed_password}})
    else:
        # Insert new record
        collection.insert_one({"uuid": uuid, "password": hashed_password, "timer": 0})

    return {"message": "Password set successfully"}


# **Validate Password**
@app.post("/v1/valpasswd")
def validate_password(request: PasswordRequest, auth: str = Depends(check_auth)):
    uuid = request.uuid
    password = request.password

    # Find device
    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")

    # Verify password
    if bcrypt.checkpw(password.encode(), user["password"]):
        # Update timer
        collection.update_one({"uuid": uuid}, {"$set": {"timer": 0}})
        return {"message": "Password validated successfully"}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

# **Timeout Timer**
@app.post("/v1/timeout_start")
def timeout_start(request: uuidRequest, auth: str = Depends(check_auth)):
    uuid = request.uuid

    # Find device
    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")
    else:
        collection.update_one({"uuid": uuid}, {"$set": {"timer": 1}})
        return {"message": "Timer started successfully"}

# **Check Timer**
@app.post("/v1/timeout_check")
def timeout_check(request: uuidRequest, auth: str = Depends(check_auth)):
    uuid = request.uuid

    # Find device
    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")
    else:
        timercache = user["timer"]
        collection.update_one({"uuid": uuid}, {"$set": {"timer": 0}})
        if timercache == 1:
            asyncio.run(call_911())
        return {"timer": timercache}

async def call_911():
    # Placeholder function to call 911
    print("Calling 911...")
    try:
        twilio_client = Client(account_sid, auth_token)

        # Make a call
        call = twilio_client.calls.create(
            to=recipient_number,
            from_=twilio_number,
            url="http://demo.twilio.com/docs/voice.xml"  # Replace with your TwiML Bin URL
        )

        print(f"Call initiated! SID: {call.sid}")

    except Exception as e:
        print(f"Error making call: {e}")

address = ""

# **Update Dangerous address**
@app.post("/v1/update_address")
def update_address(request: addressRequest, auth: str = Depends(check_auth)):
    global address
    uuid = request.uuid

    # Find device
    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")
    else:
        address = request.address
        return {"message": "Spot added"}

# **Get Dangerous address**
@app.post("/v1/get_address")
def get_address(request: uuidRequest, auth: str = Depends(check_auth)):
    global address
    uuid = request.uuid

    # Find device
    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")
    else:
        return {"address": address}

# **Predict Safety**
@app.post("/v1/predict")
def predict(request: predictRequest, auth: str = Depends(check_auth)):
    uuid = request.uuid
    latitude = request.latitude
    longitude = request.longitude

    user = collection.find_one({"uuid": uuid})

    if not user:
        raise HTTPException(status_code=404, detail="UUID not found")
    else:
        places = get_filtered_nearby_places(latitude, longitude, radius=2500)
        predicted_safety = predict_safety(places)
        return {"safety": predicted_safety}


# Run the service (local debugging)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
