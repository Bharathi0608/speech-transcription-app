/**
 * VocalFlow - SpeechEngine
 * Coordinates Browser Web Speech API, MediaRecorder, and WebSocket real-time streaming.
 */

class SpeechEngine {
  constructor(options = {}) {
    this.language = options.language || 'hi-IN';
    this.onInterim = options.onInterim || (() => {});
    this.onFinal = options.onFinal || (() => {});
    this.onAnalysis = options.onAnalysis || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    this.recognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.websocket = null;
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
    this.duration = 0;
    this.finalTranscript = '';
    this.interimTranscript = '';

    this.initWebSocket();
    this.initSpeechRecognition();
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/transcribe`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('WebSocket connected to Real-Time Speech Service');
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'interim_analysis' || data.type === 'final_analysis') {
            this.onAnalysis(data);
          }
        } catch (e) {
          console.warn('WebSocket message parse error:', e);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket connection closed, reconnecting in 3s...');
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.warn('WebSocket init error:', e);
    }
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported natively in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.language;

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.finalTranscript += (this.finalTranscript ? ' ' : '') + transcriptPart.trim();
        } else {
          interim += transcriptPart;
        }
      }

      this.interimTranscript = interim;
      const combined = (this.finalTranscript + ' ' + interim).trim();

      this.onInterim({
        final: this.finalTranscript,
        interim: this.interimTranscript,
        combined: combined
      });

      // Stream to WebSocket for real-time Hinglish analysis
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN && combined) {
        this.websocket.send(JSON.stringify({
          action: 'interim',
          text: combined
        }));
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.onError(event.error);
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        try {
          this.recognition.start(); // Auto-restart continuous listening
        } catch (e) {}
      }
    };
  }

  setLanguage(langCode) {
    this.language = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  async start() {
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.audioChunks = [];
    this.duration = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start MediaRecorder for saving audio file
      try {
        const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : {};
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.start(250); // collect 250ms chunks
      } catch (recErr) {
        console.warn('MediaRecorder init error:', recErr);
      }

      // Start SpeechRecognition
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('Recognition start error:', e);
        }
      }

      this.isRecording = true;
      this.startTime = Date.now();
      this.onStateChange(true, this.stream);

      return this.stream;
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      this.onError(err.message || 'Microphone access denied.');
      throw err;
    }
  }

  async stop() {
    this.isRecording = false;
    this.onStateChange(false, null);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }

    let audioBlob = null;
    let audioBase64 = null;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      const audioPromise = new Promise((resolve) => {
        this.mediaRecorder.onstop = async () => {
          audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          audioBase64 = await this.blobToBase64(audioBlob);
          resolve();
        };
      });
      this.mediaRecorder.stop();
      await audioPromise;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    const totalSeconds = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const finalResult = {
      content: (this.finalTranscript + ' ' + this.interimTranscript).trim(),
      duration: Math.max(1, Math.round(totalSeconds * 10) / 10),
      audioBlob: audioBlob,
      audioBase64: audioBase64
    };

    this.onFinal(finalResult);
    return finalResult;
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

window.SpeechEngine = SpeechEngine;
