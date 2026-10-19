import numpy as np
import pandas as pd
import librosa
import parselmouth
from parselmouth.praat import call
from google.colab import files

print("Libraries loaded successfully!\n")

# 2. Define the feature extraction function
def extract_parkinsons_features(audio_path):
    """
    Takes a .wav audio file and extracts the exact clinical voice biomarkers 
    matching the UCI Parkinson's dataset structure.
    """
    # Load audio into Parselmouth (Praat engine)
    sound = parselmouth.Sound(audio_path)
    
    # Extract Fundamental Frequency (Pitch stats: Fo, Fhi, Flo)
    pitch = sound.to_pitch()
    pitch_values = pitch.selected_array['frequency']
    pitch_values = pitch_values[pitch_values > 0]  # Filter out unvoiced frames
    
    mdvp_fo = np.mean(pitch_values) if len(pitch_values) > 0 else 0
    mdvp_fhi = np.max(pitch_values) if len(pitch_values) > 0 else 0
    mdvp_flo = np.min(pitch_values) if len(pitch_values) > 0 else 0
    
    # Extract Jitter (Pitch instability)
    point_process = call(sound, "To PointProcess (periodic, cc)", 0, sound.xmax, 0.0001, 0.02, 1.3)
    jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
    if np.isnan(jitter): jitter = 0.0
    
    # Extract Harmonic-to-Noise Ratio (HNR - measure of noise in the voice)
    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0, 0)
    if np.isnan(hnr): hnr = 0.0

    # Package into a structured dictionary/dataframe row
    features = {
        'MDVP:Fo(Hz)': mdvp_fo,
        'MDVP:Fhi(Hz)': mdvp_fhi,
        'MDVP:Flo(Hz)': mdvp_flo,
        'MDVP:Jitter(%)': jitter * 100,  # convert to percentage
        'HNR': hnr
    }
    
    return pd.DataFrame([features])

# 3. Upload your audio file
print("👉 Please upload your .wav audio file:")
uploaded = files.upload()

for filename in uploaded.keys():
    print(f"\nProcessing file: {filename}...")
    
    # Convert audio to data row
    data_row = extract_parkinsons_features(filename)
    
    print("\n" + "="*50)
    print("      CONVERTED AUDIO DATA (NUMERICAL ROW)      ")
    print("="*50)
    display(data_row)
    print("="*50)