"""
SmartMeter Core — Export Optimised Models to .pkl
==================================================
Run this script IN THE SAME NOTEBOOK SESSION (or after running all cells)
so that the following variables are available in memory:

  - models_tuned          : dict {cluster_id: LGBMRegressor}
  - best_params_per_cluster : dict {cluster_id: {param: value}}
  - customer_clusters_v2  : pd.Series  (Customer_ID → Cluster)
  - CUTOFF_DATE           : pd.Timestamp
  - FEATURES_V2           : list of feature names
  - df_features_v2        : DataFrame (needed to extract scaling factors)

It saves ONE consolidated .pkl file containing everything needed
to reload and run predictions.
"""

import pickle
import os
import pandas as pd

# ============================================================
# 1. Rebuild the scaling factors (train-max per customer)
# ============================================================
train_mask = df_features_v2['Time'] < CUTOFF_DATE
scaling_factors_series = (
    df_features_v2.loc[train_mask]
    .groupby('Customer_ID')['Usage']
    .max()
)

# ============================================================
# 2. Package everything into a single dict
# ============================================================
export_bundle = {
    # --- Core models (one LGBMRegressor per cluster) ---
    'models': {int(k): v for k, v in models_tuned.items()},

    # --- Optuna best hyperparameters per cluster ---
    'best_params': {int(k): v for k, v in best_params_per_cluster.items()},

    # --- Customer → Cluster mapping ---
    'customer_clusters': customer_clusters_v2.to_dict(),

    # --- Per-customer scaling factors (training-set max) ---
    'scaling_factors': scaling_factors_series.to_dict(),

    # --- Feature list expected by the models ---
    'features': FEATURES_V2 + ['Customer_ID'],

    # --- Metadata ---
    'cutoff_date': str(CUTOFF_DATE),
    'n_clusters': len(models_tuned),
    'model_type': 'LightGBM (Optuna-tuned)',
}

# ============================================================
# 3. Save to disk
# ============================================================
output_path = 'smartmeter_optimised_model.pkl'
with open(output_path, 'wb') as f:
    pickle.dump(export_bundle, f, protocol=pickle.HIGHEST_PROTOCOL)

file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"\n{'='*55}")
print(f"  Model exported successfully!")
print(f"  File : {output_path}")
print(f"  Size : {file_size_mb:.2f} MB")
print(f"  Keys : {list(export_bundle.keys())}")
print(f"  Clusters saved: {list(export_bundle['models'].keys())}")
print(f"{'='*55}")


# ============================================================
# 4. Quick verification — reload and check
# ============================================================
print("\nVerification — reloading .pkl ...")
with open(output_path, 'rb') as f:
    loaded = pickle.load(f)

for cid, mdl in loaded['models'].items():
    print(f"  Cluster {cid}: {type(mdl).__name__}, "
          f"n_estimators={mdl.n_estimators}, "
          f"best_iteration={mdl.best_iteration_}")

print(f"\n  Features expected: {loaded['features']}")
print(f"  Customers mapped: {len(loaded['customer_clusters'])}")
print(f"  Scaling factors : {len(loaded['scaling_factors'])}")
print("\nDone. You can now load this file anywhere with:")
print("    import pickle")
print("    with open('smartmeter_optimised_model.pkl', 'rb') as f:")
print("        bundle = pickle.load(f)")
