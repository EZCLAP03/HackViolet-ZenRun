import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import joblib

# Load the dataset
DATASET_FILE = "safety_data.csv"
df = pd.read_csv(DATASET_FILE)

# Drop columns where all values are 0
df = df.loc[:, (df != 0).any(axis=0)]

# Select only specified important features
important_features = [
    "police", "bar", "night_club", "hospital", "shopping_mall", "bus_station", "train_station"
]
df = df[important_features]

# Normalize the data
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df)

# Set the number of clusters to 5
num_clusters = 5

# Train K-Means Model with fixed 5 clusters
kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=1, max_iter=200)
df["safety_cluster"] = kmeans.fit_predict(X_scaled)

# Assign safety labels based on cluster characteristics
cluster_safety_labels = {
    0: "Extremely Safe",
    1: "Safe",
    2: "Moderately Safe",
    3: "Unsafe",
    4: "Extremely Unsafe"
}

df["safety_label"] = df["safety_cluster"].map(cluster_safety_labels)

# Save clustered data with labels
df.to_csv("safety_clustered_data_labeled.csv", index=False)
print("Labeled data saved as safety_clustered_data_labeled.csv")

# Analyze cluster characteristics
cluster_means = df.groupby("safety_label").mean()
print("Cluster Characteristics:\n", cluster_means)

joblib.dump(kmeans, "safety_kmeans_model.pkl")
joblib.dump(scaler, "safety_scaler.pkl")
