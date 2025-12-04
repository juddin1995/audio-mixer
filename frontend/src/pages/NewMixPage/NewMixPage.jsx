import React, { useRef, useState } from "react";
import {
  Upload,
  Play,
  Pause,
  Mic,
  Trash2,
  Volume2,
  Download,
} from "lucide-react";
import { uploadOriginal, uploadMixed } from "../../services/uploadService";

export default function AudioMixerApp() {
  const [originalFile, setOriginalFile] = useState(null);
  const [originalURL, setOriginalURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [micBlob, setMicBlob] = useState(null);
  const [mixedBlob, setMixedBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (originalURL) URL.revokeObjectURL(originalURL);
      const url = URL.createObjectURL(file);
      setOriginalFile(file);
      setOriginalURL(url);
      setMicBlob(null);
      setMixedBlob(null);
    }
  };

  async function startRecording() {
    if (!originalFile) return;
    setIsRecording(true);
    // get microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      setMicBlob(blob);
    };
    mediaRecorder.start();

    // play the original audio from start (or current position)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      try {
        await audioRef.current.play();
      } catch (e) {
        /* autoplay policies */
      }
      setIsPlaying(true);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }

  async function mixAndExport() {
    if (!originalFile || !micBlob) return;
    // decode both into AudioBuffer
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtx.sampleRate;

    const origArrayBuffer = await originalFile.arrayBuffer();
    const origBuffer = await audioCtx.decodeAudioData(origArrayBuffer.slice(0));

    const micArrayBuffer = await micBlob.arrayBuffer();
    const micBuffer = await audioCtx.decodeAudioData(micArrayBuffer.slice(0));

    const length = Math.max(origBuffer.length, micBuffer.length);
    const offlineCtx = new OfflineAudioContext(
      origBuffer.numberOfChannels,
      length,
      sampleRate
    );

    // original source
    const origSource = offlineCtx.createBufferSource();
    origSource.buffer = origBuffer;
    const origGain = offlineCtx.createGain();
    origGain.gain.value = 1.0; // allow UI later
    origSource.connect(origGain).connect(offlineCtx.destination);

    // mic source
    const micSource = offlineCtx.createBufferSource();
    micSource.buffer = micBuffer;
    const micGain = offlineCtx.createGain();
    micGain.gain.value = 1.0;
    micSource.connect(micGain).connect(offlineCtx.destination);

    origSource.start(0);
    micSource.start(0);

    const rendered = await offlineCtx.startRendering();

    const wavBlob = bufferToWavBlob(rendered);
    setMixedBlob(wavBlob);
    // cleanup
    audioCtx.close();
  }

  function bufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let interleaved;
    if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      interleaved = interleave(left, right);
    } else {
      interleaved = buffer.getChannelData(0);
    }

    const bufferLength = interleaved.length * (bitDepth / 8) + 44;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    /* RIFF identifier */ writeString(view, 0, "RIFF");
    /* file length */ view.setUint32(4, 36 + interleaved.length * 2, true);
    /* RIFF type */ writeString(view, 8, "WAVE");
    /* format chunk identifier */ writeString(view, 12, "fmt ");
    /* format chunk length */ view.setUint32(16, 16, true);
    /* sample format (raw) */ view.setUint16(20, format, true);
    /* channel count */ view.setUint16(22, numChannels, true);
    /* sample rate */ view.setUint32(24, sampleRate, true);
    /* byte rate (sampleRate * blockAlign) */ view.setUint32(
      28,
      sampleRate * numChannels * (bitDepth / 8),
      true
    );
    /* block align (channel count * bytes per sample) */ view.setUint16(
      32,
      numChannels * (bitDepth / 8),
      true
    );
    /* bits per sample */ view.setUint16(34, bitDepth, true);
    /* data chunk identifier */ writeString(view, 36, "data");
    /* data chunk length */ view.setUint32(
      40,
      interleaved.length * (bitDepth / 8),
      true
    );

    // write the PCM samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: "audio/wav" });
  }

  function interleave(left, right) {
    const length = left.length + right.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
      result[index++] = left[inputIndex];
      result[index++] = right[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  async function handleUploadOriginal() {
    if (!originalFile) return;
    setUploading(true);
    try {
      const res = await uploadOriginal(originalFile);
      alert("Original uploaded: " + res.url);
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadMixed() {
    if (!mixedBlob) return;
    setUploading(true);
    try {
      // convert blob to File to include a filename
      const file = new File([mixedBlob], `mix-${Date.now()}.wav`, {
        type: mixedBlob.type,
      });
      const res = await uploadMixed(file);
      alert("Mixed uploaded: " + res.url);
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold">Ad-Lib Recorder</h1>
          <p className="text-sm text-gray-600">
            Upload a base audio and record an ad-lib on top of it.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-3">Upload Original</h2>
              {!originalFile ? (
                <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="text-gray-600">
                    Click to upload audio file
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="audio/*"
                    onChange={handleFileUpload}
                  />
                </label>
              ) : (
                <div>
                  <p className="font-medium">{originalFile.name}</p>
                  <audio
                    ref={audioRef}
                    src={originalURL}
                    controls
                    className="w-full mt-3"
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => {
                        if (audioRef.current) audioRef.current.play();
                        setIsPlaying(true);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => {
                        if (audioRef.current) audioRef.current.pause();
                        setIsPlaying(false);
                      }}
                      className="px-3 py-2 bg-gray-200 rounded"
                    >
                      Pause
                    </button>
                    <button
                      onClick={handleUploadOriginal}
                      disabled={uploading}
                      className="ml-auto px-3 py-2 bg-green-500 text-white rounded"
                    >
                      Upload Original
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-3">
                Recorded Microphone
              </h2>
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      isRecording ? stopRecording() : startRecording()
                    }
                    disabled={!originalFile}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition ${
                      isRecording ? "bg-red-500 text-white" : "bg-gray-200"
                    }`}
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                  <div>
                    <p className="font-medium">
                      {isRecording ? "Recording..." : "Ready to record"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Record while the original plays to align timing.
                    </p>
                  </div>
                </div>

                {micBlob && (
                  <div className="mt-4">
                    <p className="text-sm">Recorded clip:</p>
                    <audio
                      controls
                      src={URL.createObjectURL(micBlob)}
                      className="w-full mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-3">Export / Mix</h2>
              <div className="space-y-3">
                <button
                  onClick={mixAndExport}
                  disabled={!originalFile || !micBlob}
                  className="w-full bg-purple-600 text-white py-2 rounded"
                >
                  Mix to WAV
                </button>
                <button
                  onClick={() => {
                    if (mixedBlob) {
                      const url = URL.createObjectURL(mixedBlob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "mix.wav";
                      a.click();
                    }
                  }}
                  disabled={!mixedBlob}
                  className="w-full bg-gray-200 py-2 rounded"
                >
                  Download Mix
                </button>
                <button
                  onClick={handleUploadMixed}
                  disabled={!mixedBlob || uploading}
                  className="w-full bg-green-600 text-white py-2 rounded"
                >
                  Upload Mixed (requires login)
                </button>
              </div>

              {mixedBlob && (
                <div className="mt-4">
                  <p className="text-sm">Mixed result preview:</p>
                  <audio
                    controls
                    src={URL.createObjectURL(mixedBlob)}
                    className="w-full mt-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
