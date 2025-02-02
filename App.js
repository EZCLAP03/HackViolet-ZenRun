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
import { Audio } from 'expo-av';  // For playing sound
import * as Constants from 'expo-constants';
import * as Application from 'expo-application';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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

function HomeScreen({ navigation }) {
  const [address, setAddress] = useState('');  // State to store the address
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
    const fetchAddress = async () => {
      try {
        const response = await axios.post(
          'https://runzen-api.w1111am.xyz/v1/get_address',
          { uuid: deviceId },
          {
            headers: {
              Authorization: 'ARRAY_BAG', // Include API key if required
            },
          }
        );
        setAddress(response.data.address); // Update state if data changes
      } catch (error) {
        console.log('Error fetching address:', error);
      }
    };

    fetchAddress(); // Initial fetch
    const interval = setInterval(fetchAddress, 5000); // Fetch every 5 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [deviceId]); // Re-run if deviceId changes

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.gradientBackground}>
        <View style={styles.homeContainer}>
          <Animated.Text style={[styles.header, { opacity: headerOpacity }]}>
            ZenRun
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
              <Text style={styles.cardTitle}>Suspicious Locations</Text>
              <Text style={styles.cardContent}>
                Address: {address ? address : "Fetching..."}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={getLocation}>
              <Text style={styles.buttonText}>Refresh Location</Text>
            </TouchableOpacity>

            {/* Updated Open Map button */}
            <TouchableOpacity
              style={[styles.button, styles.mapButton]}
              onPress={async () => {
                // Show password creation dialog
                Alert.prompt(
                  "Create Password",
                  "Enter your new password:",
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
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ uuid: deviceId, password: inputPassword }),
                          });

                          if (!response.ok) {
                            throw new Error(`API request failed with status ${response.status}`);
                          }

                          const responseData = await response.json();
                          console.log("Password set successfully:", responseData);

                          // After setting password, proceed to Map screen
                          navigation.navigate('MapScreen', { userLocation: location, deviceId });
                        } catch (error) {
                          console.error("Error setting password:", error);
                          Alert.alert("Error", "Failed to set password. Please try again.");
                        }
                      }
                    }
                  ],
                );
              }}
            >
              <Text style={styles.buttonText}>Open Map</Text>
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
  const [safetyScores, setSafetyScores] = useState([]);
  const [averageSafetyScore, setAverageSafetyScore] = useState(null);

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

  const getAddress = async (lat, lng) => {
    const url = `https://api.openrouteservice.org/geocode/reverse?point.lon=${lng}&point.lat=${lat}&api_key=${ORS_APIKEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error with API request");
      }
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const address = data.features[0].properties.label;
        console.log("Address:", address);
        return address;
      } else {
        console.log("No address found");
        return "No address found";
      }
    } catch (error) {
      console.error("Error:", error);
      return "Error with API request";
    }
  };

  const handleSuspiciousButton = async () => {
    if (location) {
      const address = await getAddress(location.latitude, location.longitude);  // Get the address based on location
      console.log(`Suspicious location detected: ${address}`);
      try {
        const response = await axios.post(
          'https://runzen-api.w1111am.xyz/v1/update_address',
          {
            uuid: deviceId,
            address: address,
          },
          {
            headers: {
              Authorization: 'ARRAY_BAG',
            },
          }
        );
        console.log("Address sent successfully:", response.data);
        alert('Suspicious location reported!');
      } catch (error) {
        console.error('Error sending address to server:', error);
        alert('Failed to report suspicious location.');
      }
    } else {
      console.log("Location not available yet.");
    }
  };

 // Route-based prediction, but sending each lat/lon individually
 const predictSafetyForRoute = async (routeCoordinates) => {
    try {
      // 1) Build a subset of at most 30 points, evenly spaced along the route.
      let pointsToCheck = [];
      const maxCalls = 5;
      
      if (routeCoordinates.length <= maxCalls) {
        // If the route has 30 or fewer points, just use them all.
        pointsToCheck = routeCoordinates;
      } else {
        // Otherwise, spread out 30 calls evenly
        for (let i = 0; i < maxCalls; i++) {
          // pick an index proportionally across the route
          const index = Math.floor(i * routeCoordinates.length / maxCalls);
          pointsToCheck.push(routeCoordinates[index]);
        }
      }

      // 2) Now loop through these (up to) 30 points and make calls
      let overallSafety = null;

      for (const point of pointsToCheck) {
        const { latitude, longitude } = point;

        // Send each lat/lon individually (max 30)
        const response = await axios.post(
          'https://runzen-api.w1111am.xyz/v1/predict',
          {
            uuid: deviceId,
            latitude,
            longitude,
          },
          {
            headers: {
              Authorization: 'ARRAY_BAG',
            },
          }
        );

        const safety = response.data.safety;
        console.log("Individual point safety:", safety);

        // Example aggregator logic
        if (safety === 'Unsafe') {
          overallSafety = 'Unsafe';
        } else if (safety === 'Extremely Safe') {
          if (overallSafety !== 'Unsafe') {
            overallSafety = 'Extremely Safe';
          }
        } else if (safety === 'Safe') {
          if (!overallSafety || overallSafety === 'Safe') {
            overallSafety = 'Safe';
          }
        }
      }

      if (!overallSafety) {
        overallSafety = 'Safety prediction is unclear';
      }

      console.log("Predicted overall route safety:", overallSafety);
      if (overallSafety === 'Extremely Safe') {
        alert("This route is extremely safe! You can proceed.");
      } else if (overallSafety === 'Safe') {
        alert("This route is safe!");
      } else if (overallSafety === 'Unsafe') {
        alert("This route is unsafe! Please consider choosing another path.");
      } else {
        alert("Safety prediction is unclear. Please try again.");
      }

      return overallSafety;
    } catch (error) {
      console.error('Error fetching safety prediction:', error);
      alert("Failed to fetch safety prediction. Please try again.");
      return null;
    }
  };
  const handleRoutePrediction = async () => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const safety = await predictSafetyForRoute(routeCoordinates);
      if (safety !== null) {
        console.log("Route safety score:", safety);
      } else {
        alert("Unable to calculate safety score for the route.");
      }
    } else {
    }
  };

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

            const threshold = 50; 
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
                let soundObject = null; // Store the sound object globally

                startTimeoutAPI();
                const systemSound = require('./assets/alert_sound.mp3'); // Make sure this asset actually exists

                const playSound = async () => {
                  try {
                    const { sound } = await Audio.Sound.createAsync(systemSound);
                    soundObject = sound;
                    await sound.playAsync();
                  } catch (error) {
                    console.error("Error playing sound:", error);
                  }
                };

                playSound();

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
                        if (soundObject) {
                          await soundObject.stopAsync();
                        }
                        setDisableDeviationCheck(true);
                        setAlertShown(false);
                      } else {
                        if (soundObject) {
                          await soundObject.stopAsync();
                        }
                        console.log("Invalid password");
                      }
                    } catch (error) {
                      if (soundObject) {
                        await soundObject.stopAsync();
                      }
                    }
                  }
                );
              } else {
                // If you really don't care about Android, do nothing here
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
        // Build the full route
        const fullRoute = data.features[0].geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        // For partial route, 40% example
        const sliceCount = Math.floor(fullRoute.length * 0.4);
        const partialRoute = fullRoute.slice(0, sliceCount);

        console.log('Full Route Coordinates (length):', fullRoute.length);
        console.log('Using Partial Route (length):', partialRoute.length);

        const sampledCount = Math.floor(fullRoute.length * 0.4);
        const partialForApi = fullRoute.slice(0, sampledCount);
        // We only set routeCoordinates to the partial route
        setRouteCoordinates(fullRoute);
        
        await predictSafetyForRoute(partialForApi);

        // Now do the overall route safety check
        await handleRoutePrediction();
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
          >
            {destinationCoords && (
              <>
                <Marker
                  coordinate={destinationCoords}
                  title="Destination"
                  pinColor="red"
                />
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

        <View style={styles.suspiciousButtonContainer}>
          <TouchableOpacity style={styles.suspiciousButton} onPress={handleSuspiciousButton}>
            <Text style={styles.buttonText}>Suspicious</Text>
          </TouchableOpacity>
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
    backgroundColor: '#ffffff',
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
  mapButton: {
    backgroundColor: '#75899e',
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
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
  suspiciousButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  suspiciousButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
  },
});
