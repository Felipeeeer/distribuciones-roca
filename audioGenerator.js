/**
 * 🎵 Generador de Sonidos para Notificaciones
 * Utilidad para crear sonidos específicos por tipo de notificación
 */

class AudioGenerator {
  constructor() {
    this.audioContext = null;
    this.init();
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('No se pudo inicializar AudioContext:', error);
    }
  }

  /**
   * Genera un sonido de notificación
   * @param {string} type - Tipo de notificación (success, error, warning, info)
   * @param {number} duration - Duración en segundos
   * @returns {Promise<Blob>} - Blob del audio generado
   */
  async generateNotificationSound(type = 'info', duration = 0.3) {
    if (!this.audioContext) {
      throw new Error('AudioContext no disponible');
    }

    const frequencies = {
      success: [800, 1000, 1200], // Tono ascendente alegre
      error: [400, 350, 300],     // Tono descendente grave
      warning: [600, 700, 600],   // Tono oscilante
      info: [700, 750, 700]       // Tono suave
    };

    const freq = frequencies[type] || frequencies.info;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const channelData = buffer.getChannelData(0);

    // Generar onda
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate;
      const progress = time / duration;
      
      // Seleccionar frecuencia basada en el progreso
      let currentFreq;
      if (freq.length === 1) {
        currentFreq = freq[0];
      } else {
        const freqIndex = Math.floor(progress * (freq.length - 1));
        const nextFreqIndex = Math.min(freqIndex + 1, freq.length - 1);
        const freqProgress = (progress * (freq.length - 1)) % 1;
        currentFreq = freq[freqIndex] + (freq[nextFreqIndex] - freq[freqIndex]) * freqProgress;
      }

      // Generar onda sinusoidal con envolvente
      const envelope = this.getEnvelope(progress);
      const wave = Math.sin(2 * Math.PI * currentFreq * time);
      channelData[i] = wave * envelope * 0.3; // Volumen reducido
    }

    // Convertir a WAV
    return this.bufferToWav(buffer);
  }

  /**
   * Genera una envolvente para el sonido
   */
  getEnvelope(progress) {
    const attack = 0.1;
    const decay = 0.2;
    const sustain = 0.7;
    const release = 0.2;

    if (progress < attack) {
      return progress / attack;
    } else if (progress < attack + decay) {
      const decayProgress = (progress - attack) / decay;
      return 1 - (1 - sustain) * decayProgress;
    } else if (progress < 1 - release) {
      return sustain;
    } else {
      const releaseProgress = (progress - (1 - release)) / release;
      return sustain * (1 - releaseProgress);
    }
  }

  /**
   * Convierte un AudioBuffer a formato WAV
   */
  bufferToWav(buffer) {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // Escribir cabecera WAV
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Escribir datos de audio
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Escribe una cadena en el DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Descarga un archivo de audio
   */
  downloadAudio(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Genera y descarga todos los sonidos de notificación
   */
  async generateAllNotificationSounds() {
    const types = ['success', 'error', 'warning', 'info'];
    
    for (const type of types) {
      try {
        console.log(`Generando sonido para ${type}...`);
        const blob = await this.generateNotificationSound(type);
        this.downloadAudio(blob, `${type}-notification.wav`);
        console.log(`Sonido ${type} generado y descargado`);
      } catch (error) {
        console.error(`Error generando sonido ${type}:`, error);
      }
    }
  }
}

// Crear instancia global
const audioGenerator = new AudioGenerator();

// Exponer funciones globalmente
window.audioGenerator = audioGenerator;
window.generateNotificationSounds = () => audioGenerator.generateAllNotificationSounds();

export default audioGenerator; 