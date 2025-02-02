import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import * as Location from 'expo-location';
import * as Constants from 'expo-constants';
import * as Application from 'expo-application';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORS_APIKEY = '5b3ce3597851110001cf6248308d79ba8f934d9a8c85e2893b04c563'; // Replace with your actual API key

// Helper function to calculate distance using the Haversine formula.
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

/**
 * drawArea
 *
 * A helper function to return a Circle overlay.
 *
 * @param {Object} coordinate - A coordinate object with properties latitude and longitude.
 * @param {string} type - The type of area. Pass "safe" for a green (safe) area and "danger" for a red (dangerous) area.
 * @returns {JSX.Element|null} A Circle component or null if no coordinate is provided.
 */
function drawArea(coordinate, type) {
  if (!coordinate) return null;

  let fillColor, strokeColor, radius;
  switch (type) {
    case 'extremely unsafe':
      fillColor = 'rgba(255,0,0,0.3)';   
      strokeColor = 'rgba(255,0,0,0.5)';
      radius = 200;                     
      break;
    case 'unsafe':
      fillColor = 'rgba(255,102,0,0.3)';   
      strokeColor = 'rgba(255,102,0,0.5)';
      radius = 150;                    
      break;
    case 'moderate':
      fillColor = 'rgba(255,255,0,0.3)';   
      strokeColor = 'rgba(255,255,0,0.5)';
      radius = 100;                        
      break;
    case 'safe':
      fillColor = 'rgba(0,255,0,0.3)';     
      strokeColor = 'rgba(0,255,0,0.5)';
      radius = 50;                         
      break;
    case 'extremely safe':
      fillColor = 'rgba(0,128,0,0.3)';      
      strokeColor = 'rgba(0,128,0,0.5)';
      radius = 25;                         
      break;
    default:
      return null;
  }

  return (
    <Circle
      center={coordinate}
      radius={radius}
      fillColor={fillColor}
      strokeColor={strokeColor}
    />
  );
}


function HomeScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Fetching location...');
  const [deviceId, setDeviceId] = useState('');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(40)).current;

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

  useEffect(() => {
    const getUniqueDeviceId = async () => {
      try {
        let uniqueDeviceId = '';
        if (Application.androidId) {
          uniqueDeviceId = Application.androidId;
        } else {
          let storedUuid = await AsyncStorage.getItem('device_uuid');
          if (!storedUuid) {
            storedUuid = uuid.v4();
            await AsyncStorage.setItem('device_uuid', storedUuid);
          }
          uniqueDeviceId = storedUuid;
        }
        setDeviceId(uniqueDeviceId);
      } catch (error) {
        console.error("Error fetching device ID:", error);
        setDeviceId("Error fetching ID");
      }
    };

    getUniqueDeviceId();
    getLocation();

    // Animate header fade-in.
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Animate cards slide-up.
    Animated.timing(cardTranslateY, {
      toValue: 0,
      duration: 1000,
      delay: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleCreatePassword = () => {
    Alert.prompt(
      'Create Password',
      'Enter your new password:',
      [
        {
          text: 'Cancel',
          onPress: () => console.log('Password creation canceled'),
          style: 'cancel'
        },
        {
          text: 'Send',
          onPress: async (inputPassword) => {
            if (!inputPassword) {
              console.log("Password cannot be empty.");
              return;
            }
            try {
              const response = await fetch("https://runzen-api.w1111am.xyz/v1/setpasswd", {
                method: "POST",
                headers: {
                  "Authorization": "ARRAY_BAG",
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  uuid: deviceId,
                  password: inputPassword
                })
              });
              if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
              }
              const responseData = await response.json();
              console.log("Password saved successfully:", responseData, inputPassword);
            } catch (error) {
              console.error("Error saving password:", error);
            }
          }
        }
      ],
      "secure-text"
    );
  };  

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.gradientBackground}>
        <View style={styles.homeContainer}>
          <Animated.Text style={[styles.header, { opacity: headerOpacity }]}>
            ZenRunning
          </Animated.Text>
          <Animated.View style={[styles.cardContainer, { transform: [{ translateY: cardTranslateY }] }]}>
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
          </Animated.View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={getLocation}>
              <Text style={styles.buttonText}>Refresh Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.mapButton]}
              onPress={() => navigation.navigate('MapScreen', { userLocation: location, deviceId })}
            >
              <Text style={styles.buttonText}>Open Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.mapButton]}
              onPress={handleCreatePassword}
            >
              <Text style={styles.buttonText}>Create Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MapScreen({ route }) {
  const { userLocation, deviceId } = route.params; 
  const [location, setLocation] = useState(userLocation);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [alertShown, setAlertShown] = useState(false);
  const [disableDeviationCheck, setDisableDeviationCheck] = useState(false);

  const mapHeaderOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mapHeaderOpacity, {
      toValue: 1,
      duration: 1200,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const routeCoordinatesRef = useRef(routeCoordinates);
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
  }, [routeCoordinates]);

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

            const threshold = 1; 
            if (minDistance > threshold && !alertShown) {
              console.log("User is off course. Minimum distance from route:", minDistance);
              setAlertShown(true);

              if (Platform.OS === 'ios') {
                const startTimeoutAPI = async () => {
                  try {
                    const response = await fetch("https://runzen-api.w1111am.xyz/v1/timeout_start", {
                      method: "POST",
                      headers: {
                        "Authorization": "ARRAY_BAG",
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({ uuid: deviceId })
                    });
                    if (!response.ok) {
                      throw new Error(`API request failed with status ${response.status}`);
                    }
                    const responseData = await response.json();
                    console.log("Timeout API response:", responseData);
                  } catch (error) {
                    console.error("Error calling timeout API:", error);
                  }
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  try {
                    const checkResponse = await fetch("https://runzen-api.w1111am.xyz/v1/timeout_check", {
                      method: "POST",
                      headers: {
                        "Authorization": "ARRAY_BAG",
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({ uuid: deviceId })
                    });
                    if (!checkResponse.ok) {
                      throw new Error(`Timeout check API failed with status ${checkResponse.status}`);
                    }
                    const checkData = await checkResponse.json();
                    console.log("Timeout check response:", checkData);
                    if (checkData.timer === 1) {
                      setDisableDeviationCheck(true);
                      setAlertShown(false);
                    }
                  } catch (error) {
                    console.error("Error checking timeout status:", error);
                  }
                };
                startTimeoutAPI();
                Alert.prompt(
                  "Are you OK?",
                  "Enter your password:",
                  async (password) => {
                    try {
                      const response = await fetch("https://runzen-api.w1111am.xyz/v1/valpasswd", {
                        method: "POST",
                        headers: {
                          "Authorization": "ARRAY_BAG",
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ uuid: deviceId, password })
                      });
                      if (!response.ok) {
                        throw new Error(`Password validation failed with status ${response.status}`);
                      }
                      const data = await response.json();
                      console.log("Password validation response:", data);
                      if (data.message === "Password validated successfully") {
                        setDisableDeviationCheck(true);
                        setAlertShown(false);
                      } else {
                        console.log("Invalid password");
                      }
                    } catch (error) {
                      console.error("Error validating password:", error);
                      Alert.alert("Error", "Failed to validate password. Please try again.");
                    }
                  }
                );
              } else {
                
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
      <View style={styles.gradientBackground}>
        <View style={styles.mapScreenContainer}>
          <Animated.Text style={[styles.mapHeader, { opacity: mapHeaderOpacity }]}>
            Set Your Destination
          </Animated.Text>
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
              <>
                <Marker
                  coordinate={destinationCoords}
                  title="Destination"
                  pinColor="red"
                />
                {/* Use the drawArea helper function to draw the safe area */}
                {drawArea(destinationCoords, 'safe')}
                {/* Use the drawArea helper function to draw the dangerous area */}
                {drawArea(destinationCoords, 'extremely unsafe')}
              </>
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
    backgroundColor: '#fff',
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#ffffff', // Solid white background
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  cardContainer: {
    marginBottom: 30,
    width: '100%',
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cardContent: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#6d856e',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  mapButton: {
    backgroundColor: '#75899e',
  },
  mapScreenContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
  },
  mapHeader: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
});
