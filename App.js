import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import * as Location from 'expo-location';
import * as Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapView, { Marker, Polyline } from 'react-native-maps';

const ORS_APIKEY = '5b3ce3597851110001cf6248308d79ba8f934d9a8c85e2893b04c563'; // Replace with your actual OpenRouteService API key

// Helper function to calculate distance using Haversine formula.
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

  // Get the unique device ID and location when component mounts.
  useEffect(() => {
    const uniqueDeviceId = Constants.deviceId; // Using deviceId from Constants
    setDeviceId(uniqueDeviceId);
    getLocation();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.homeContainer}>
        <Text style={styles.header}>ZenRunning</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location Status</Text>
          <Text style={styles.cardContent}>{locationStatus}</Text>
          {location && (
            <Text style={styles.cardContent}>
              Latitude: {location.latitude.toFixed(5)} | Longitude: {location.longitude.toFixed(5)}
            </Text>
          )}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Information</Text>
          <Text style={styles.cardContent}>Device ID: {deviceId}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={getLocation}>
            <Text style={styles.buttonText}>Refresh Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.mapButton]}
            onPress={() => navigation.navigate('MapScreen', { userLocation: location })}
          >
            <Text style={styles.buttonText}>Open Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MapScreen({ route }) {
  const { userLocation } = route.params;
  const [location, setLocation] = useState(userLocation);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [alertShown, setAlertShown] = useState(false);
  const [disableDeviationCheck, setDisableDeviationCheck] = useState(false);

  const routeCoordinatesRef = useRef(routeCoordinates);
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
  }, [routeCoordinates]);

  // If no userLocation is passed, fetch it.
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

  // Continuously watch user's location.
  useEffect(() => {
    let subscription;
    const subscribeLocation = async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const currentCoords = loc.coords;
          setLocation(currentCoords);
          
          if (!disableDeviationCheck && routeCoordinatesRef.current.length > 0) {
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
            
            const threshold = 25;
            if (minDistance > threshold && !alertShown) {
              console.log("User is off course. Minimum distance from route:", minDistance);
              setAlertShown(true);
              if (Platform.OS === 'ios') {
                Alert.prompt(
                  "Are you OK?",
                  "Enter your password:",
                  (password) => {
                    if (password === "hello") {
                      setDisableDeviationCheck(true);
                    } else {
                      console.log("oh no");
                    }
                    setAlertShown(false);
                  }
                );
              } else {
                Alert.alert(
                  "Are you OK?",
                  "Simulated prompt: Assume password entered is wrong.",
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        console.log("oh no");
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

  // Handle tap on the map to set destination and fetch route.
  const handleMapTap = (e) => {
    const tappedLocation = e.nativeEvent.coordinate;
    setDisableDeviationCheck(false);
    setAlertShown(false);
    if (
      !destinationCoords ||
      (destinationCoords.latitude !== tappedLocation.latitude ||
        destinationCoords.longitude !== tappedLocation.longitude)
    ) {
      setDestinationCoords(tappedLocation);
      fetchRoute(location, tappedLocation);
    }
  };

  // Fetch route using OpenRouteService API.
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mapScreenContainer}>
        <Text style={styles.mapHeader}>Set Your Destination</Text>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location ? location.latitude : 37.7749,
              longitude: location ? location.longitude : -122.4194,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onPress={handleMapTap}
            showsUserLocation={true}
            followsUserLocation={true}
          >
            {destinationCoords && (
              <Marker
                coordinate={destinationCoords}
                title="Destination"
                pinColor="red"
              />
            )}
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={4}
                strokeColor="red"
                lineDashPattern={[1, 5]}
              />
            )}
          </MapView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const Stack = createStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false, // We’re handling headers inside our screens.
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="MapScreen" component={MapScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  homeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'space-evenly',
    backgroundColor: '#f8f9fa'
  },
  header: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    color: '#555'
  },
  cardContent: {
    fontSize: 16,
    color: '#777'
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
  },
  mapButton: {
    backgroundColor: '#2ecc71',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  mapScreenContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapHeader: {
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 15,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    color: '#333'
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
