"use client";

import { useState, useRef, useCallback } from "react";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

interface AudioPlayButtonProps {
  src: string;
  label?: string;
  size?: "1" | "2" | "3";
}

export function AudioPlayButton({ src, label = "Listen", size = "2" }: AudioPlayButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  }, []);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // If currently playing or loading, stop
    if (playing || loading) {
      stopAudio();
      return;
    }

    setLoading(true);
    setError(false);

    // Clean up any previous instance
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(src);
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
      audioRef.current = null;
    };

    audio.onerror = () => {
      setLoading(false);
      setError(true);
      setPlaying(false);
      audioRef.current = null;
    };

    audio.load();
  }

  if (error) {
    return (
      <Tooltip content="Audio unavailable">
        <IconButton
          variant="ghost"
          color="gray"
          size={size}
          disabled
          aria-label="Audio unavailable"
        >
          <VolumeX className="w-4 h-4" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={playing ? "Stop" : label}>
      <IconButton
        variant="ghost"
        color={playing ? "indigo" : "gray"}
        highContrast
        size={size}
        onClick={handleClick}
        aria-label={playing ? "Stop audio" : label}
        style={{ cursor: "pointer" }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </IconButton>
    </Tooltip>
  );
}
