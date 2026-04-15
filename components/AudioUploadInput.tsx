"use client";

import { useState, useCallback, useRef } from "react";
import { Box, Text, Flex, Progress, IconButton, Tooltip } from "@radix-ui/themes";
import { Upload, X, FileAudio, CheckCircle2, AlertCircle } from "lucide-react";
import { validateAudioFile, formatFileSize, AudioValidationResult } from "@/lib/audio-validation";
import { fetchAPI } from "@/lib/fetch-api";

interface AudioUploadInputProps {
  collection: string;
  itemId: string;
  onUploadComplete?: (audioUrl: string) => void;
  onUploadError?: (error: string) => void;
  currentAudioUrl?: string;
}

interface UploadState {
  status: "idle" | "validating" | "getting-url" | "uploading" | "completing" | "success" | "error";
  progress: number;
  error?: string;
  fileName?: string;
  fileSize?: number;
}

export function AudioUploadInput({
  collection,
  itemId,
  onUploadComplete,
  onUploadError,
  currentAudioUrl,
}: AudioUploadInputProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
  });
  const [validation, setValidation] = useState<AudioValidationResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const resetUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadState({ status: "idle", progress: 0 });
    setValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {

    setValidation(null);
    setUploadState({ status: "validating", progress: 10, fileName: file.name, fileSize: file.size });

    const fileValidation = validateAudioFile(file);
    setValidation(fileValidation);

    if (!fileValidation.valid) {
      setUploadState({
        status: "error",
        progress: 0,
        error: fileValidation.errors.join(", "),
        fileName: file.name,
        fileSize: file.size,
      });
      onUploadError?.(fileValidation.errors.join(", "));
      return;
    }

    try {

      setUploadState((prev) => ({ ...prev, status: "getting-url", progress: 20 }));

      const { data } = await fetchAPI("/api/v1/upload", {
        method: "POST",
        body: JSON.stringify({
          collection,
          itemId,
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!data.uploadUrl) {
        throw new Error("Failed to get upload URL");
      }

      setUploadState((prev) => ({ ...prev, status: "uploading", progress: 30 }));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const uploadProgress = 30 + (e.loaded / e.total) * 60; // 30-90%
          setUploadState((prev) => ({ ...prev, progress: uploadProgress }));
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {

          setUploadState((prev) => ({ ...prev, status: "completing", progress: 95 }));

          try {
            await fetchAPI("/api/v1/upload/complete", {
              method: "POST",
              body: JSON.stringify({
                collection,
                itemId,
                key: data.key,
                accessUrl: data.accessUrl,
              }),
            });

            setUploadState({
              status: "success",
              progress: 100,
              fileName: file.name,
              fileSize: file.size,
            });

            onUploadComplete?.(data.accessUrl);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Failed to complete upload");
          }
        } else {
          throw new Error(`Upload failed: ${xhr.statusText}`);
        }
      });

      xhr.addEventListener("error", () => {
        setUploadState({
          status: "error",
          progress: 0,
          error: "Network error during upload",
          fileName: file.name,
          fileSize: file.size,
        });
        onUploadError?.("Network error during upload");
      });

      xhr.open("PUT", data.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload audio";
      setUploadState({
        status: "error",
        progress: 0,
        error: errorMessage,
        fileName: file.name,
        fileSize: file.size,
      });
      onUploadError?.(errorMessage);
    }
  }, [collection, itemId, onUploadComplete, onUploadError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const isUploading = ["validating", "getting-url", "uploading", "completing"].includes(uploadState.status);

  if (uploadState.status === "success") {
    return (
      <Box
        style={{
          border: "2px solid var(--green-6)",
          borderRadius: "var(--radius-3)",
          padding: "var(--space-4)",
          backgroundColor: "var(--green-2)",
        }}
      >
        <Flex align="center" gap="2">
          <CheckCircle2 className="w-5 h-5" style={{ color: "var(--green-9)" }} />
          <Box style={{ flex: 1 }}>
            <Text size="2" weight="medium" style={{ color: "var(--green-9)" }}>
              Audio uploaded successfully
            </Text>
            {uploadState.fileName && (
              <Text size="1" color="gray">
                {uploadState.fileName} ({formatFileSize(uploadState.fileSize || 0)})
              </Text>
            )}
          </Box>
          <Tooltip content="Upload another file">
            <IconButton variant="ghost" size="1" onClick={resetUpload}>
              <Upload className="w-4 h-4" />
            </IconButton>
          </Tooltip>
        </Flex>
      </Box>
    );
  }

  if (isUploading) {
    return (
      <Box
        style={{
          border: "2px solid var(--indigo-6)",
          borderRadius: "var(--radius-3)",
          padding: "var(--space-4)",
          backgroundColor: "var(--indigo-2)",
        }}
      >
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <FileAudio className="w-5 h-5" style={{ color: "var(--indigo-9)" }} />
              <Text size="2" weight="medium" style={{ color: "var(--indigo-9)" }}>
                {uploadState.status === "validating" && "Validating file..."}
                {uploadState.status === "getting-url" && "Preparing upload..."}
                {uploadState.status === "uploading" && "Uploading audio..."}
                {uploadState.status === "completing" && "Finalizing..."}
              </Text>
            </Flex>
            <Text size="1" color="gray">
              {Math.round(uploadState.progress)}%
            </Text>
          </Flex>
          <Progress value={uploadState.progress} size="1" />
          {uploadState.fileName && (
            <Text size="1" color="gray">
              {uploadState.fileName} ({formatFileSize(uploadState.fileSize || 0)})
            </Text>
          )}
        </Flex>
      </Box>
    );
  }

  if (uploadState.status === "error") {
    return (
      <Box
        style={{
          border: "2px solid var(--red-6)",
          borderRadius: "var(--radius-3)",
          padding: "var(--space-4)",
          backgroundColor: "var(--red-2)",
        }}
      >
        <Flex align="center" gap="2">
          <AlertCircle className="w-5 h-5" style={{ color: "var(--red-9)" }} />
          <Box style={{ flex: 1 }}>
            <Text size="2" weight="medium" style={{ color: "var(--red-9)" }}>
              Upload failed
            </Text>
            <Text size="1" color="gray">
              {uploadState.error || "Unknown error"}
            </Text>
          </Box>
          <Tooltip content="Try again">
            <IconButton variant="ghost" size="1" onClick={resetUpload}>
              <Upload className="w-4 h-4" />
            </IconButton>
          </Tooltip>
        </Flex>
      </Box>
    );
  }

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        style={{
          border: `2px dashed ${dragActive ? "var(--indigo-8)" : "var(--gray-6)"}`,
          borderRadius: "var(--radius-3)",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: dragActive ? "var(--indigo-2)" : "var(--gray-2)",
          transition: "all 0.2s ease",
          minHeight: "120px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Flex direction="column" align="center" gap="2">
          <Upload
            className="w-8 h-8"
            style={{ color: dragActive ? "var(--indigo-9)" : "var(--gray-8)" }}
          />
          <Text size="2" weight="medium">
            {dragActive ? "Drop audio file here" : "Drag & drop audio file here"}
          </Text>
          <Text size="1" color="gray">
            or click to browse • MP3, WAV, OGG, M4A, FLAC (max 50MB)
          </Text>
          {currentAudioUrl && (
            <Text size="1" color="gray" style={{ marginTop: "var(--space-2)" }}>
              Current audio: {currentAudioUrl.substring(0, 50)}...
            </Text>
          )}
        </Flex>
      </Box>

      {validation && !validation.valid && (
        <Box mt="2">
          <Flex direction="column" gap="1">
            {validation.errors.map((error, index) => (
              <Text key={index} size="1" style={{ color: "var(--red-9)" }}>
                <AlertCircle className="w-3 h-3" style={{ display: "inline", marginRight: "4px" }} />
                {error}
              </Text>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}
