"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Video } from "@/content/videos";

type VideoFeatureProps = {
  video: Video;
};

function focusPlayer(node: HTMLElement | null) {
  node?.focus();
}

export function VideoFeature({ video }: VideoFeatureProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden border border-gold bg-black">
      {playing ? (
        <Player video={video} />
      ) : (
        <Poster video={video} onPlay={() => setPlaying(true)} />
      )}
    </div>
  );
}

function Poster({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <>
      <Image
        src={video.poster}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-contain"
      />
      <button
        type="button"
        className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[image:var(--gold-gradient)] text-black"
        aria-label={`Odtwórz film: ${video.title}`}
        onClick={onPlay}
      >
        <Play className="ml-0.5 size-7" strokeWidth={1.5} fill="currentColor" aria-hidden />
      </button>
    </>
  );
}

function Player({ video }: { video: Video }) {
  if (video.provider === "youtube" && video.youtubeId) {
    return (
      <iframe
        ref={focusPlayer}
        title={video.title}
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        tabIndex={-1}
      />
    );
  }

  if (video.provider === "self" && video.src) {
    return (
      <video
        ref={focusPlayer}
        className="absolute inset-0 h-full w-full object-contain"
        controls
        autoPlay
        playsInline
      >
        {video.src.webm ? <source src={video.src.webm} type="video/webm" /> : null}
        <source src={video.src.mp4} type="video/mp4" />
      </video>
    );
  }

  return null;
}
