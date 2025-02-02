import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Constants from 'expo-constants'; // Import Constants API
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapView, { Marker, Polyline } from 'react-native-maps';

const ORS_APIKEY = '5b3ce3597851110001cf6248308d79ba8f934d9a8c85e2893b04c563'; // Replace with your actual OpenRouteService API key

// A helper function to calculate distance (in meters) between two lat/lon coordinates using the Haversine formula.
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function HomeScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Fetching location...');
  const [deviceId, setDeviceId] = useState('');

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationStatus('Permission to access location was denied');
      return;
    }
    const currentLocation = await Location.getCurrentPositionAsync({});
    setLocation(currentLocation.coords);
    setLocationStatus('Location fetched');
  };

  // Get the unique device ID
  useEffect(() => {
    const uniqueDeviceId = Constants.deviceId; // Using deviceId from Constants
    setDeviceId(uniqueDeviceId);
    getLocation();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>ZenRunning</Text>
      <View style={styles.locationContainer}>
        <Text style={styles.locationStatus}>{locationStatus}</Text>
        {location && (
          <Text style={styles.locationText}>
            Latitude: {location.latitude}, Longitude: {location.longitude}
          </Text>
        )}
      </View>
      <Text style={styles.deviceIdText}>
        Device ID: {deviceId}  {/* Display unique device ID */}
      </Text>
      <TouchableOpacity style={styles.button} onPress={getLocation}>
        <Text style={styles.buttonText}>Get Current Location</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('MapScreen', { userLocation: location })}
      >
        <Text style={styles.buttonText}>Open Map</Text>
      </TouchableOpacity>
    </View>
  );
}

function MapScreen({ route }) {
  const { userLocation } = route.params;
  const [location, setLocation] = useState(userLocation);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]); // Store route polyline coordinates
  const [alertShown, setAlertShown] = useState(false); // To prevent multiple alerts
  const [disableDeviationCheck, setDisableDeviationCheck] = useState(false); // Disable checking once correct password is entered

  // A ref to always have the latest routeCoordinates for our location subscription callback
  const routeCoordinatesRef = useRef(routeCoordinates);
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
  }, [routeCoordinates]);

  // Fetch user's current location if not passed as prop
  useEffect(() => {
    if (!userLocation) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Allow location access in settings.');
          return;
        }
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation.coords);
      })();
    }
  }, [userLocation]);

  // Continuously watch user's location
  useEffect(() => {
    let subscription;
    const subscribeLocation = async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const currentCoords = loc.coords;
          setLocation(currentCoords);
          
          // Only check deviation if a route exists and deviation checking is enabled
          if (!disableDeviationCheck && routeCoordinatesRef.current.length > 0) {
            // Compute minimum distance from user's current location to any point on the route
            let minDistance = Infinity;
            routeCoordinatesRef.current.forEach((point) => {
              const d = getDistance(
                currentCoords.latitude,
                currentCoords.longitude,
                point.latitude,
                point.longitude
              );
              if (d < minDistance) minDistance = d;
            });
            
            // Threshold for deviation (in meters)
            const threshold = 25;
            if (minDistance > threshold && !alertShown) {
              console.log("User is off course. Minimum distance from route:", minDistance);
              setAlertShown(true);
              // Show a prompt asking if the user is OK and to enter a password
              if (Platform.OS === 'ios') {
                Alert.prompt(
                  "Are you OK?",
                  "Enter your password:",
                  (password) => {
                    if (password === "hello") {
                      // Correct password disables further deviation checks until a new destination is set
                      setDisableDeviationCheck(true);
                    } else {
                      console.log("IT FKIN WORKS HAHA");
                    }
                    // Reset alertShown so future deviations can trigger the prompt if deviation checking is enabled
                    setAlertShown(false);
                  }
                );
              } else {
                // For Android, simulate the prompt using Alert.alert and assume wrong password for demonstration.
                Alert.alert(
                  "Are you OK?",
                  "Simulated prompt: Assume password entered is wrong.",
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        console.log("IT FKIN WORKS HAHA");
                        setAlertShown(false);
                      }
                    }
                  ]
                );
              }
            }
          }
        }
      );
    };
    subscribeLocation();
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [alertShown, disableDeviationCheck]);

  // Handle map tap event to set destination and fetch route
  const handleMapTap = (e) => {
    const tappedLocation = e.nativeEvent.coordinate;
    // Reset deviation checking when a new destination is chosen.
    setDisableDeviationCheck(false);
    setAlertShown(false);
    if (
      !destinationCoords ||
      (destinationCoords.latitude !== tappedLocation.latitude ||
        destinationCoords.longitude !== tappedLocation.longitude)
    ) {
      console.log("Starting Location:", location);
      console.log("Final Destination:", tappedLocation);
      setDestinationCoords(tappedLocation);
      // Fetch route from OpenRouteService
      fetchRoute(location, tappedLocation);
    }
  };

  // Fetch route using OpenRouteService API
  const fetchRoute = async (start, end) => {
    if (!start || !end || !start.longitude || !start.latitude || !end.longitude || !end.latitude) {
      Alert.alert("Error", "Invalid coordinates for route.");
      return;
    }
  
    const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_APIKEY}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`;
    console.log(`Fetching route from: ${start.latitude}, ${start.longitude} to ${end.latitude}, ${end.longitude}`);
  
    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log('API Response:', data);
  
      if (data.features && data.features[0] && data.features[0].geometry) {
        const route = data.features[0].geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        setRouteCoordinates(route);
      } else {
        Alert.alert('Error', 'Route not found.');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert("Error", "Failed to fetch route.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Set Your Destination</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location ? location.latitude : 37.7749,
          longitude: location ? location.longitude : -122.4194,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        onPress={handleMapTap} // Handle map taps to set destination
        showsUserLocation={true} // Show user's location with blue circle
        followsUserLocation={true} // Keep the map focused on the user’s location
      >
        {destinationCoords && (
          <Marker coordinate={destinationCoords} title="Destination" pinColor="red" />
        )}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="red"
            lineDashPattern={[1, 5]} // For dashed line style
          />
        )}
      </MapView>
    </View>
  );
}

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  locationStatus: {
    fontSize: 16,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deviceIdText: {
    fontSize: 16,
    marginTop: 20,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    marginVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
