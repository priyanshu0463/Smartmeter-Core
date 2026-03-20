"""
SmartMeter Core — Load .pkl and Run Inference
==============================================
This script shows how to load the exported model bundle
and make predictions on new data.
"""

import pickle
import pandas as pd
import numpy as np

# ============================================================
# 1. Load the model bundle
# ============================================================
with open('smartmeter_optimised_model.pkl', 'rb') as f:
    bundle = pickle.load(f)

models            = bundle['models']             # {cluster_id: LGBMRegressor}
customer_clusters = bundle['customer_clusters']  # {customer_id: cluster_id}
scaling_factors   = bundle['scaling_factors']     # {customer_id: train_max}
features          = bundle['features']           # list of feature names
best_params       = bundle['best_params']        # {cluster_id: {param: val}}

print(f"Loaded {len(models)} cluster models")
print(f"Features expected: {features}")
print(f"Customers mapped: {len(customer_clusters)}")


# ============================================================
# 2. Feature engineering function (must match training)
# ============================================================
def engineer_features_v2(df_in):
    """Reproduce the exact feature engineering from training."""
    data = df_in.copy()

    data['hour'] = data['Time'].dt.hour
    data['day_of_week'] = data['Time'].dt.dayofweek
    data['is_weekend'] = (data['day_of_week'] >= 5).astype(int)
    data['month'] = data['Time'].dt.month

    data['hour_sin'] = np.sin(2 * np.pi * data['hour'] / 24)
    data['hour_cos'] = np.cos(2 * np.pi * data['hour'] / 24)

    data['lag_24h']  = data.groupby('Customer_ID')['Usage'].shift(48)
    data['lag_48h']  = data.groupby('Customer_ID')['Usage'].shift(96)
    data['lag_1week'] = data.groupby('Customer_ID')['Usage'].shift(336)

    data['rolling_mean_2h'] = data.groupby('Customer_ID')['Usage'].transform(
        lambda x: x.shift(1).rolling(window=4).mean()
    )
    data['rolling_max_24h'] = data.groupby('Customer_ID')['Usage'].transform(
        lambda x: x.shift(1).rolling(window=48).max()
    )

    data['velocity'] = data.groupby('Customer_ID')['Usage'].diff()
    data['velocity_lag1'] = data.groupby('Customer_ID')['velocity'].shift(1)

    data = data.dropna()
    return data


# ============================================================
# 3. Predict function
# ============================================================
def predict(df_long, bundle):
    """
    Takes a long-format DataFrame with columns:
        Time, Customer_ID, Usage, quarter, season
    Returns DataFrame with Predicted column in real kWh.
    """
    # Feature engineering
    df_feat = engineer_features_v2(df_long)

    # Map clusters
    df_feat['Cluster'] = df_feat['Customer_ID'].map(bundle['customer_clusters'])
    df_feat = df_feat.dropna(subset=['Cluster'])

    # Make Customer_ID categorical (required by LightGBM)
    df_feat['Customer_ID'] = df_feat['Customer_ID'].astype('category')

    all_preds = []

    for cluster_id, model in bundle['models'].items():
        mask = df_feat['Cluster'] == cluster_id
        subset = df_feat[mask].copy()

        if len(subset) == 0:
            continue

        X = subset[bundle['features']]
        preds_norm = model.predict(X)

        # Inverse-transform: multiply by training-set max
        scale = subset['Customer_ID'].astype(str).map(bundle['scaling_factors'])
        preds_real = preds_norm * scale.values

        subset['Predicted'] = preds_real
        all_preds.append(subset[['Time', 'Customer_ID', 'Usage', 'Predicted', 'Cluster']])

    return pd.concat(all_preds).rename(columns={'Usage': 'Actual'})


# ============================================================
# 4. Example usage (uncomment when you have data)
# ============================================================
# df = pd.read_csv('data.csv')
# customer_cols = [c for c in df.columns if c.startswith('x')][:500]
# df_long = pd.melt(df, id_vars=['Time', 'quarter', 'season'],
#                    value_vars=customer_cols,
#                    var_name='Customer_ID', value_name='Usage')
# df_long['Time'] = pd.to_datetime(df_long['Time'], dayfirst=True)
# df_long = df_long.sort_values(['Customer_ID', 'Time']).reset_index(drop=True)
#
# results = predict(df_long, bundle)
# print(results.head())
