/**
 * VocalFlow - Real-Time Canvas Audio Visualizer
 * Uses Web Audio API AnalyserNode to draw vibrant neon frequency bars & waveforms.
 */

class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.isRecording = false;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.drawIdle();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  async start(stream) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.isRecording = true;

      this.animateLive();
    } catch (err) {
      console.warn('AudioVisualizer initialization error:', err);
      this.drawIdle();
    }
  }

  stop() {
    this.isRecording = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.drawIdle();
  }

  animateLive() {
    if (!this.isRecording || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.animateLive());
    this.analyser.getByteFrequencyData(this.dataArray);

    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;

    this.ctx.clearRect(0, 0, width, height);

    const barCount = 48;
    const barWidth = (width / barCount) - 3;
    let x = 2;

    const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#06b6d4');

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * this.dataArray.length);
      const val = this.dataArray[dataIndex] || 0;
      const barHeight = Math.max(6, (val / 255) * height * 0.85);

      const y = (height - barHeight) / 2;

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, Math.max(2, barWidth), barHeight, 4);
      this.ctx.fill();

      x += barWidth + 3;
    }
  }

  drawIdle() {
    if (!this.ctx) return;
    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;

    this.ctx.clearRect(0, 0, width, height);

    const barCount = 48;
    const barWidth = (width / barCount) - 3;
    let x = 2;

    for (let i = 0; i < barCount; i++) {
      const barHeight = 4 + Math.sin(i * 0.35) * 3;
      const y = (height - barHeight) / 2;

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, Math.max(2, barWidth), barHeight, 2);
      this.ctx.fill();

      x += barWidth + 3;
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
