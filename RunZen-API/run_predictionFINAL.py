import joblib
import numpy as np
from app import cluster_safety_labels  # Import safety labels
import os
from dotenv import load_dotenv
import requests


load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# Load the trained model and scaler
kmeans = joblib.load("safety_kmeans_model.pkl")
scaler = joblib.load("safety_scaler.pkl")


place_types = ["police", "bar", "night_club", "hospital", "shopping_mall", "bus_station", "train_station"]


def get_filtered_nearby_places(latitude, longitude, radius=10000):
    """
    Fetches nearby places of specific types using Google Places API.
    
    Parameters:
        latitude (float): Latitude of location.
        longitude (float): Longitude of location.
        radius (int): Search radius in meters.
    
    Returns:
        dict: Dictionary containing counts for each place type.
    """
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    results = {"latitude": latitude, "longitude": longitude}

    for place_type in place_types:
        params = {
            "key": GOOGLE_API_KEY,
            "location": f"{latitude},{longitude}",
            "radius": radius,
            "type": place_type
        }

        response = requests.get(url, params=params)
        data = response.json()
        results[place_type] = len(data.get("results", []))  # Count of places found

    return results

def predict_safety(input_data):
    """
    Predicts the safety label for a given input.

    Parameters:
        input_data (dict): A dictionary containing values for each place type.

    Returns:
        str: Predicted safety label.
    """
    
    
    # Convert input data to numpy array and scale it
    input_array = np.array([input_data[place] for place in place_types]).reshape(1, -1)
    input_scaled = scaler.transform(input_array)

    # Predict cluster
    cluster_label = kmeans.predict(input_scaled)[0]

    # Get safety label
    return cluster_safety_labels[cluster_label]

# Example usage
# latitude, longitude = 25.8175, -80.1272  # Example location
# safety_data = get_filtered_nearby_places(latitude, longitude, radius=2500)

# Predict safety
# predicted_safety = predict_safety(safety_data)
# print(f"Predicted Safety: {predicted_safety}")
