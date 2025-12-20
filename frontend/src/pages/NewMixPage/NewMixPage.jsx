import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, Square, Download, Trash2, Volume2, Music } from 'lucide-react';

export default function AudioMixer() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [mixedAudioUrl, setMixedAudioUrl] = useState(null);
  const [isMixing, setIsMixing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadVolume, setUploadVolume] = useState(1);
  const [recordVolume, setRecordVolume] = useState(1);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const uploadedAudioRef = useRef(null);
  const recordedAudioRef = useRef(null);
  const mixedAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      if (mixedAudioUrl) URL.revokeObjectURL(mixedAudioUrl);
    };
  }, [uploadedAudioUrl, recordedAudioUrl, mixedAudioUrl]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setUploadedAudioUrl(url);
      setMixedAudioUrl(null);
    } else {
      alert('Please upload a valid audio file');
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Verify stream has audio tracks
      const audioTracks = stream.getAudioTracks();
      console.log('Audio tracks:', audioTracks.length);
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream');
      }
      console.log('Audio track:', audioTracks[0].label, 'enabled:', audioTracks[0].enabled, 'readyState:', audioTracks[0].readyState);
      
      streamRef.current = stream;
      
      // Determine best mimeType
      let options = {};
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { mimeType };
          console.log('Using mimeType:', mimeType);
          break;
        }
      }
      
      if (!options.mimeType) {
        console.warn('No supported mimeType found, using default');
      }

      console.log('Creating MediaRecorder with options:', options);
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      
      console.log('MediaRecorder created. State:', mediaRecorderRef.current.state);
      
      // Create a promise to track when recording is fully stopped
      let stopResolve;
      const stopPromise = new Promise((resolve) => {
        stopResolve = resolve;
      });

      mediaRecorderRef.current.ondataavailable = (e) => {
        console.log('Data available event:', e.data.size, 'bytes', 'Type:', e.data.type);
        // Always push the data, even if size is 0 (some browsers send empty chunks)
        if (e.data && e.data.size >= 0) {
          audioChunksRef.current.push(e.data);
          console.log('Chunk added. Total chunks:', audioChunksRef.current.length, 'Total size:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes');
        } else {
          console.warn('Received invalid data chunk:', e.data);
        }
      };

      mediaRecorderRef.current.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        console.error('Error details:', e.error);
        alert('Recording error occurred. Please try again.');
        if (stopResolve) stopResolve();
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('MediaRecorder onstop fired. Chunks:', audioChunksRef.current.length);
        console.log('Chunk details:', audioChunksRef.current.map((chunk, i) => ({
          index: i,
          size: chunk.size,
          type: chunk.type
        })));
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('Total chunks size:', totalSize, 'bytes');
        
        // Wait a bit to ensure all dataavailable events have fired
        setTimeout(() => {
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          console.log('Creating blob with mimeType:', mimeType);
          
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Recorded blob created. Size:', blob.size, 'bytes');
          
          if (blob.size === 0) {
            console.error('Empty blob created!');
            console.error('Chunks array:', audioChunksRef.current);
            console.error('Chunks total size:', totalSize);
            alert('Recording failed: No audio data was captured. Please try again.');
            if (stopResolve) stopResolve();
            return;
          }
          
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
          setMixedAudioUrl(null);
          
          console.log('✓ Recording complete. Blob URL created:', url);
          console.log('✓ Blob stored in state. Size:', blob.size, 'bytes');
          
          // Verify blob is still valid after a moment
          setTimeout(() => {
            console.log('✓ Blob verification - Size:', blob.size, 'bytes, Type:', blob.type);
            if (blob.size === 0) {
              console.error('⚠️ WARNING: Blob became 0 bytes after storage!');
            }
          }, 500);
          
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
              track.stop();
              console.log('Stream track stopped:', track.kind);
            });
            streamRef.current = null;
          }
          
          if (stopResolve) stopResolve();
        }, 100); // Small delay to ensure all events are processed
      };
      
      // Store the resolve function for cleanup
      mediaRecorderRef.current._stopResolve = stopResolve;

      // Start recording with timeslice to get regular data chunks
      console.log('Starting MediaRecorder...');
      mediaRecorderRef.current.start(100); // Request data every 100ms
      
      console.log('MediaRecorder started. State:', mediaRecorderRef.current.state);
      console.log('MimeType:', mediaRecorderRef.current.mimeType);
      
      // Verify it's actually recording
      setTimeout(() => {
        if (mediaRecorderRef.current) {
          console.log('MediaRecorder state after start:', mediaRecorderRef.current.state);
          if (mediaRecorderRef.current.state !== 'recording') {
            console.error('MediaRecorder failed to start recording!');
            alert('Failed to start recording. Please try again.');
            setIsRecording(false);
            stream.getTracks().forEach(track => track.stop());
            return;
          }
        }
      }, 100);
      
      setIsRecording(true);
      setRecordingTime(0);

      let recordingSeconds = 0;
      recordingIntervalRef.current = setInterval(() => {
        recordingSeconds++;
        setRecordingTime(recordingSeconds);
        
        // Log chunk collection progress every 2 seconds
        if (recordingSeconds % 2 === 0) {
          const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log(`Recording progress: ${recordingSeconds}s, Chunks: ${audioChunksRef.current.length}, Total size: ${totalSize} bytes`);
        }
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) {
      console.warn('Cannot stop: MediaRecorder not active');
      return;
    }

    console.log('Stopping recording. Current state:', mediaRecorderRef.current.state);
    console.log('Current chunks before stop:', audioChunksRef.current.length);

    try {
      // Check if recorder is in recording state
      if (mediaRecorderRef.current.state === 'recording') {
        // Request final data chunk - this is important!
        console.log('Requesting final data chunk...');
        mediaRecorderRef.current.requestData();
        
        // Wait a moment for the dataavailable event to fire
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log('Chunks after requestData:', audioChunksRef.current.length);
        
        // Now stop the recorder
        console.log('Stopping MediaRecorder...');
        mediaRecorderRef.current.stop();
      } else if (mediaRecorderRef.current.state === 'inactive') {
        console.warn('MediaRecorder is already inactive');
      } else {
        console.log('MediaRecorder state:', mediaRecorderRef.current.state, '- stopping anyway');
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping MediaRecorder:', err);
      // Force stop even if there's an error
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('Failed to force stop:', e);
      }
    }
    
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    // Don't stop the stream here - let onstop handle it after blob is created
    // This ensures the stream stays active until all data is collected
  };

  const mixAudioFilesBackend = async () => {
    if (!uploadedFile || !recordedBlob) {
      alert('Please upload an audio file and record audio first');
      return;
    }

    setIsMixing(true);

    try {
      console.log('Starting backend mix process...');
      console.log('Uploaded file:', uploadedFile.name, uploadedFile.size, 'bytes');
      console.log('Recorded blob:', recordedBlob.size, 'bytes, type:', recordedBlob.type);

      // Verify blob has data
      if (recordedBlob.size === 0) {
        throw new Error('Recorded audio is empty (0 bytes). Please record again.');
      }

      console.log('Blob details before conversion:', {
        size: recordedBlob.size,
        type: recordedBlob.type,
        constructor: recordedBlob.constructor.name
      });

      // Read blob as ArrayBuffer to ensure data is available
      console.log('Reading blob as ArrayBuffer...');
      const arrayBuffer = await recordedBlob.arrayBuffer();
      console.log('ArrayBuffer read. Size:', arrayBuffer.byteLength, 'bytes');
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Blob data is empty after reading. Please record again.');
      }

      // Get file extension from blob type
      let extension = 'webm';
      if (recordedBlob.type.includes('webm')) {
        extension = 'webm';
      } else if (recordedBlob.type.includes('ogg')) {
        extension = 'ogg';
      } else if (recordedBlob.type.includes('mp4')) {
        extension = 'mp4';
      } else if (recordedBlob.type.includes('wav')) {
        extension = 'wav';
      }

      // Create File directly from ArrayBuffer - this is more reliable
      const recordedFile = new File(
        [arrayBuffer],  // Use ArrayBuffer directly, not a Blob
        `recording.${extension}`,
        { 
          type: recordedBlob.type,
          lastModified: Date.now()
        }
      );

      console.log('Converted recorded file:', recordedFile.name, recordedFile.size, 'bytes');
      
      // Verify the File object has the same size
      if (recordedFile.size !== arrayBuffer.byteLength) {
        console.error('File size mismatch! ArrayBuffer:', arrayBuffer.byteLength, 'File:', recordedFile.size);
        throw new Error(`File conversion failed: expected ${arrayBuffer.byteLength} bytes, got ${recordedFile.size} bytes`);
      }
      
      // Verify file is readable and has correct data
      const fileArrayBuffer = await recordedFile.arrayBuffer();
      console.log('File ArrayBuffer verification size:', fileArrayBuffer.byteLength, 'bytes');
      if (fileArrayBuffer.byteLength !== arrayBuffer.byteLength) {
        throw new Error(`File data mismatch: expected ${arrayBuffer.byteLength} bytes, got ${fileArrayBuffer.byteLength} bytes`);
      }
      
      // Verify first and last bytes match to ensure data integrity
      const originalFirst = new Uint8Array(arrayBuffer, 0, Math.min(10, arrayBuffer.byteLength));
      const fileFirst = new Uint8Array(fileArrayBuffer, 0, Math.min(10, fileArrayBuffer.byteLength));
      const firstBytesMatch = originalFirst.every((byte, i) => byte === fileFirst[i]);
      console.log('First bytes match:', firstBytesMatch);
      
      if (!firstBytesMatch) {
        console.warn('First bytes do not match - data may be corrupted');
      }

      // Verify files before creating FormData (but don't read them - that would consume them)
      console.log('Files to send:');
      console.log('  original:', uploadedFile.name, uploadedFile.size, 'bytes', uploadedFile.type);
      console.log('  mic:', recordedFile.name, recordedFile.size, 'bytes', recordedFile.type);
      
      // Create FormData immediately after file creation to avoid any data loss
      const formData = new FormData();
      
      // Append files with explicit filenames
      formData.append('original', uploadedFile, uploadedFile.name);
      formData.append('mic', recordedFile, recordedFile.name);

      console.log('FormData created. Total expected size:', uploadedFile.size + recordedFile.size, 'bytes');
      
      // Log FormData structure (this doesn't consume it)
      console.log('FormData has entries for: original, mic');
      
      // Verify the files are still valid (check size property, don't read)
      if (uploadedFile.size === 0) {
        throw new Error('Original file is empty');
      }
      if (recordedFile.size === 0) {
        throw new Error('Recorded file is empty');
      }
      
      console.log('✓ Both files validated before sending');

      console.log('Sending to backend...');
      const response = await fetch('/api/audio/mix', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let browser set it with boundary
      });
      
      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Backend mixing failed');
      }

      // Get the blob from response
      const mixedBlob = await response.blob();
      console.log('Received mixed audio:', mixedBlob.size, 'bytes');

      if (mixedBlob.size === 0) {
        throw new Error('Backend returned empty file. Please check server logs.');
      }

      const url = URL.createObjectURL(mixedBlob);
      setMixedAudioUrl(url);
      setIsMixing(false);
    } catch (err) {
      console.error('✗ Backend mix failed:', err);
      alert(`Error mixing audio: ${err.message}`);
      setIsMixing(false);
    }
  };

  const mixAudioFiles = async () => {
    if (!uploadedFile || !recordedBlob) {
      alert('Please upload an audio file and record audio first');
      return;
    }

    setIsMixing(true);

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      console.log('Starting client-side mix process...');
      console.log('Uploaded file:', uploadedFile.name, uploadedFile.size, 'bytes');
      console.log('Recorded blob:', recordedBlob.size, 'bytes, type:', recordedBlob.type);
      
      // Decode uploaded file
      const uploadedArrayBuffer = await uploadedFile.arrayBuffer();
      console.log('Uploaded ArrayBuffer length:', uploadedArrayBuffer.byteLength);
      
      let uploadedAudioBuffer;
      try {
        uploadedAudioBuffer = await audioContext.decodeAudioData(uploadedArrayBuffer.slice(0));
        console.log('✓ Uploaded audio decoded, duration:', uploadedAudioBuffer.duration.toFixed(2), 's');
      } catch (err) {
        console.error('✗ Error decoding uploaded audio:', err);
        throw new Error('Failed to decode uploaded audio file.');
      }

      // Decode recorded audio
      const recordedArrayBuffer = await recordedBlob.arrayBuffer();
      console.log('Recorded ArrayBuffer length:', recordedArrayBuffer.byteLength);
      
      let recordedAudioBuffer;
      try {
        recordedAudioBuffer = await audioContext.decodeAudioData(recordedArrayBuffer.slice(0));
        console.log('✓ Recorded audio decoded, duration:', recordedAudioBuffer.duration.toFixed(2), 's');
      } catch (err) {
        console.error('✗ Error decoding recorded audio:', err);
        console.error('Blob type was:', recordedBlob.type);
        throw new Error('Failed to decode recorded audio. Your browser may not support this audio format. Try using Chrome or Edge.');
      }

      const maxDuration = Math.max(uploadedAudioBuffer.duration, recordedAudioBuffer.duration);
      const maxLength = Math.ceil(maxDuration * audioContext.sampleRate);
      
      const numberOfChannels = Math.max(uploadedAudioBuffer.numberOfChannels, recordedAudioBuffer.numberOfChannels);
      console.log('Creating mixed buffer:', numberOfChannels, 'channels,', maxDuration.toFixed(2), 's');
      
      const mixedBuffer = audioContext.createBuffer(
        numberOfChannels,
        maxLength,
        audioContext.sampleRate
      );

      for (let channel = 0; channel < numberOfChannels; channel++) {
        const mixedData = mixedBuffer.getChannelData(channel);
        
        const uploadedData = uploadedAudioBuffer.getChannelData(
          Math.min(channel, uploadedAudioBuffer.numberOfChannels - 1)
        );
        const recordedData = recordedAudioBuffer.getChannelData(
          Math.min(channel, recordedAudioBuffer.numberOfChannels - 1)
        );

        for (let i = 0; i < maxLength; i++) {
          const uploadedSample = i < uploadedData.length ? uploadedData[i] * uploadVolume : 0;
          const recordedSample = i < recordedData.length ? recordedData[i] * recordVolume : 0;
          mixedData[i] = uploadedSample + recordedSample;
        }
      }

      console.log('✓ Channels mixed, rendering...');

      const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        mixedBuffer.length,
        audioContext.sampleRate
      );
      const source = offlineContext.createBufferSource();
      source.buffer = mixedBuffer;
      source.connect(offlineContext.destination);
      source.start();

      const renderedBuffer = await offlineContext.startRendering();
      console.log('✓ Audio rendered');
      
      const wavBlob = await audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      console.log('✓ Mixed audio created:', wavBlob.size, 'bytes');
      setMixedAudioUrl(url);
      setIsMixing(false);
    } catch (err) {
      console.error('✗ Mix failed:', err);
      alert(`Error mixing audio: ${err.message}`);
      setIsMixing(false);
    }
  };

  const decodeAudioViaMediaElement = (blob, audioContext) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.src = url;
      
      audio.addEventListener('canplaythrough', async () => {
        try {
          const mediaElementSource = audioContext.createMediaElementSource(audio);
          const destination = audioContext.createMediaStreamDestination();
          mediaElementSource.connect(destination);
          
          const mediaRecorder = new MediaRecorder(destination.stream);
          const chunks = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            const newBlob = new Blob(chunks, { type: 'audio/webm' });
            const arrayBuffer = await newBlob.arrayBuffer();
            try {
              const buffer = await audioContext.decodeAudioData(arrayBuffer);
              URL.revokeObjectURL(url);
              resolve(buffer);
            } catch (err) {
              URL.revokeObjectURL(url);
              reject(err);
            }
          };
          
          mediaRecorder.start();
          audio.play();
          
          audio.addEventListener('ended', () => {
            mediaRecorder.stop();
          });
          
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      });
      
      audio.addEventListener('error', (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load recorded audio'));
      });
      
      audio.load();
    });
  };

  const audioBufferToWav = (buffer) => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(buffer.numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
    setUint16(buffer.numberOfChannels * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const downloadMixedAudio = () => {
    if (mixedAudioUrl) {
      const a = document.createElement('a');
      a.href = mixedAudioUrl;
      a.download = 'mixed-audio.wav';
      a.click();
    }
  };

  const clearAll = () => {
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setUploadedFile(null);
    setUploadedAudioUrl(null);
    setRecordedAudioUrl(null);
    setRecordedBlob(null);
    setMixedAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setUploadVolume(1);
    setRecordVolume(1);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Audio Mixer Studio
            </h1>
            <p className="text-gray-600">
              Upload a track, record your voice, and mix them together
            </p>
          </div>

          <div className="space-y-6">
            {/* Upload Section */}
            <div className="border-2 border-purple-300 rounded-xl p-6 bg-purple-50">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Music className="w-5 h-5" />
                Step 1: Upload Background Track
              </h2>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
              />
              {uploadedAudioUrl && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">✓ {uploadedFile.name}</p>
                  <audio ref={uploadedAudioRef} src={uploadedAudioUrl} controls className="w-full mb-3" />
                  <div className="mt-3">
                    <label className="text-sm text-gray-700 font-medium flex items-center gap-2 mb-1">
                      <Volume2 className="w-4 h-4" />
                      Track Volume: {Math.round(uploadVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={uploadVolume}
                      onChange={(e) => setUploadVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Recording Section */}
            <div className="border-2 border-blue-300 rounded-xl p-6 bg-blue-50">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Step 2: Record Your Audio
              </h2>
              <div className="flex items-center gap-4 mb-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 transition font-semibold shadow-lg"
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-full hover:bg-gray-900 transition font-semibold animate-pulse shadow-lg"
                  >
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </button>
                )}
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-lg font-mono text-red-600 font-bold">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
              </div>
              {recordedAudioUrl && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">✓ Recording complete!</p>
                  <audio ref={recordedAudioRef} src={recordedAudioUrl} controls className="w-full mb-3" />
                  <div className="mt-3">
                    <label className="text-sm text-gray-700 font-medium flex items-center gap-2 mb-1">
                      <Volume2 className="w-4 h-4" />
                      Recording Volume: {Math.round(recordVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={recordVolume}
                      onChange={(e) => setRecordVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mix Section */}
            <div className="border-2 border-green-300 rounded-xl p-6 bg-green-50">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Step 3: Mix & Play
              </h2>
              <button
                onClick={mixAudioFiles}
                disabled={!uploadedFile || !recordedBlob || isMixing}
                className="bg-green-600 text-white px-8 py-3 rounded-full hover:bg-green-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg text-lg"
              >
                {isMixing ? 'Mixing Audio...' : '🎵 Mix Audio Files'}
              </button>
              
              {mixedAudioUrl && (
                <div className="mt-6 p-4 bg-white rounded-lg shadow-inner">
                  <p className="text-lg text-green-700 font-bold mb-3 flex items-center gap-2">
                    ✓ Mixed Audio Ready!
                  </p>
                  <audio ref={mixedAudioRef} src={mixedAudioUrl} controls className="w-full mb-4" />
                  <button
                    onClick={downloadMixedAudio}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Download Mixed Audio
                  </button>
                </div>
              )}
            </div>

            {/* Clear Button */}
            {(uploadedFile || recordedBlob) && (
              <div className="text-center pt-4">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 transition font-semibold mx-auto"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear All & Start Over
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 bg-white rounded-lg p-4 shadow">
          <p className="font-semibold mb-2">💡 Tips:</p>
          <p>• Adjust volume sliders before mixing to balance your tracks</p>
          <p>• The mixed audio plays both tracks simultaneously</p>
          <p>• Download your creation when you're happy with the mix!</p>
        </div>
      </div>
    </div>
  );
}