"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Flex, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { Play, Pause, Volume2, RotateCcw } from "lucide-react";
import { formatDuration } from "@/lib/audio-validation";

interface AudioPreviewProps {
  audioUrl: string;
  label?: string;
  showWaveform?: boolean;
  onRemove?: () => void;
}

export function AudioPreview({
  audioUrl,
  label = "Audio Preview",
  showWaveform = true,
  onRemove,
}: AudioPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const generateWaveformData = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }

      const maxVal = Math.max(...filteredData);
      const normalizedData = filteredData.map((val) => val / maxVal);
      
      setWaveformData(normalizedData);
      setDuration(audioBuffer.duration);
      audioContext.close();
    } catch (error) {
      console.warn("Failed to generate waveform:", error);
    }
  }, []);

  useEffect(() => {
    if (audioUrl && showWaveform) {
      const timer = setTimeout(() => generateWaveformData(audioUrl), 0);
      return () => clearTimeout(timer);
    }
  }, [audioUrl, showWaveform, generateWaveformData]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    if (playing) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playing]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
    setCurrentTime(0);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playing) {
      stopAudio();
      return;
    }

    setLoading(true);
    setError(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setLoading(false);
      setPlaying(true);
      audio.play().catch(() => {
        setPlaying(false);
        setError(true);
      });
    };

    audio.onended = () => {
      setPlaying(false);
      setCurrentTime(0);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setLoading(false);
      setError(true);
      setPlaying(false);
      audioRef.current = null;
    };

    audio.load();
  }, [audioUrl, playing, stopAudio]);

  const handleRewind = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || waveformData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, width, height);

    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * height * 0.8;
      const y = (height - barHeight) / 2;

      const isPlayed = index / waveformData.length <= progress;
      ctx.fillStyle = isPlayed ? "var(--indigo-9)" : "var(--gray-6)";
      
      ctx.fillRect(x, y, barWidth * 0.8, barHeight);
    });
  }, [waveformData, currentTime, duration]);

  if (error) {
    return (
      <Box
        style={{
          border: "1px solid var(--red-6)",
          borderRadius: "var(--radius-3)",
          padding: "var(--space-3)",
          backgroundColor: "var(--red-2)",
        }}
      >
        <Flex align="center" gap="2">
          <Volume2 className="w-4 h-4" style={{ color: "var(--red-9)" }} />
          <Text size="2" style={{ color: "var(--red-9)" }}>
            Audio preview unavailable
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box
      style={{
        border: "1px solid var(--gray-6)",
        borderRadius: "var(--radius-3)",
        padding: "var(--space-3)",
        backgroundColor: "var(--gray-2)",
      }}
    >
      <Flex direction="column" gap="3">
        {/* Header */}
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Volume2 className="w-4 h-4" style={{ color: "var(--indigo-9)" }} />
            <Text size="2" weight="medium">
              {label}
            </Text>
          </Flex>
          {onRemove && (
            <Tooltip content="Remove audio">
              <IconButton type="button" variant="ghost" size="1" onClick={onRemove}>
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M11.7816 4.03156C12.0062 3.81595 12.0062 3.46776 11.7816 3.25215C11.557 3.03654 11.1935 3.03654 10.9689 3.25215L7.50005 6.58034L4.03116 3.25215C3.80655 3.03654 3.44305 3.03654 3.21844 3.25215C2.99383 3.46776 2.99383 3.81595 3.21844 4.03156L6.68733 7.35975L3.21844 10.6879C2.99383 10.9036 2.99383 11.2517 3.21844 11.4674C3.44305 11.683 3.80655 11.683 4.03116 11.4674L7.50005 8.13918L10.9689 11.4674C11.1935 11.683 11.557 11.683 11.7816 11.4674C12.0062 11.2517 12.0062 10.9036 11.7816 10.6879L8.31272 7.35975L11.7816 4.03156Z"
                    fill="currentColor"
                  />
                </svg>
              </IconButton>
            </Tooltip>
          )}
        </Flex>

        {/* Waveform */}
        {showWaveform && waveformData.length > 0 && (
          <Box style={{ position: "relative" }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={60}
              style={{
                width: "100%",
                height: "60px",
                display: "block",
              }}
            />
          </Box>
        )}

        {/* Controls */}
        <Flex align="center" gap="2">
          <Tooltip content={playing ? "Pause" : "Play"}>
            <IconButton
              type="button"
              variant="solid"
              color="indigo"
              size="2"
              onClick={handlePlayPause}
              disabled={loading}
            >
              {loading ? (
                <svg
                  className="animate-spin w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : playing ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip content="Rewind">
            <IconButton type="button" variant="ghost" size="2" onClick={handleRewind}>
              <RotateCcw className="w-4 h-4" />
            </IconButton>
          </Tooltip>

          {/* Time display */}
          <Box style={{ flex: 1 }}>
            <Flex justify="between" align="center">
              <Text size="1" color="gray" style={{ fontFamily: "monospace" }}>
                {formatDuration(currentTime)}
              </Text>
              <Text size="1" color="gray" style={{ fontFamily: "monospace" }}>
                {duration > 0 ? formatDuration(duration) : "--:--"}
              </Text>
            </Flex>
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}
