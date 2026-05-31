"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { IconButton, Tooltip, Flex } from "@radix-ui/themes";
import { Volume2, VolumeX, Loader2 } from "lucide-react";


interface AudioPlayButtonProps {
  src: string;
  label?: string;
  size?: "1" | "2" | "3";
  showDuration?: boolean;
}

export function AudioPlayButton({ src, label = "Listen", size = "2", showDuration = true }: AudioPlayButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!src) return;

    const audio = new Audio();
    audio.src = src;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    return () => {
      audio.src = "";
    };
  }, [src]);

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

    if (playing || loading) {
      stopAudio();
      return;
    }

    setLoading(true);
    setError(false);

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
    <Flex align="center" gap="2">
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
      {/* {showDuration && duration > 0 && !playing && (
        <Text size="1" color="gray" style={{ fontFamily: "monospace" }}>
          {formatDuration(duration)}
        </Text>
      )} */}
    </Flex>
  );
}
