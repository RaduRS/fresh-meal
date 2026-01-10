"use client";

import type { IScannerControls } from "@zxing/browser";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  ChecksumException,
  FormatException,
  NotFoundException,
} from "@zxing/library";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function BarcodeScanner(props: {
  onDetected: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reader = useMemo(() => new BrowserMultiFormatReader(), []);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, [reader]);

  async function start() {
    setError(null);
    setRunning(true);

    const video = videoRef.current;
    if (!video) {
      setError("Camera not available.");
      setRunning(false);
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      setRunning(false);
      return;
    }

    try {
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {}
        controlsRef.current = null;
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const controls = await reader.decodeFromStream(
        stream,
        video,
        (result, err, innerControls) => {
          if (result) {
            const text = result.getText().trim();
            if (text) {
              try {
                innerControls.stop();
              } catch {}
              controlsRef.current = null;
              if (streamRef.current) {
                for (const track of streamRef.current.getTracks()) track.stop();
                streamRef.current = null;
              }
              setRunning(false);
              props.onDetected(text);
            }
            return;
          }

          if (
            err &&
            !(err instanceof NotFoundException) &&
            !(err instanceof ChecksumException) &&
            !(err instanceof FormatException)
          ) {
            setError("Could not read barcode. Try again.");
          }
        }
      );

      controlsRef.current = controls;
    } catch (e) {
      const name =
        e && typeof e === "object" && "name" in e
          ? String((e as { name: unknown }).name)
          : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission denied."
          : "Camera permission denied or unavailable."
      );
      setRunning(false);
    }
  }

  function stop() {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setRunning(false);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm font-medium">Scan barcode</div>
        <div className="text-sm text-muted-foreground">
          Point the camera at the barcode.
        </div>

        <div className="relative overflow-hidden rounded-lg border bg-black">
          <video
            ref={videoRef}
            className="h-56 w-full object-cover"
            playsInline
            muted
            autoPlay
          />
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={start} disabled={running}>
            {running ? "Scanning…" : "Start scan"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={stop}
            disabled={!running}
          >
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
