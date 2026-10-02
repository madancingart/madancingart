import type { StaticImageData } from "next/image";
import trenerzyPoster from "@/assets/video/trenerzy.jpg";

export type Video = {
  id: string;
  title: string;
  description: string;
  provider: "youtube" | "self";
  youtubeId?: string;
  src?: {
    mp4: string;
    webm?: string;
  };
  poster: StaticImageData;
  uploadDate: string;
  durationIso?: string;
};

export const trenerzy: Video = {
  id: "trenerzy",
  title: "Aleksandra Janosz i Mikołaj Mazur",
  description:
    "Stały duet od 2019 roku, oboje z międzynarodową klasą S w tańcach latynoamerykańskich.",
  provider: "self",
  src: {
    mp4: "/videos/trenerzy.mp4",
    webm: "/videos/trenerzy.webm",
  },
  poster: trenerzyPoster,
  uploadDate: "2026-10-01",
  durationIso: "PT30.8S",
};

export const teamAmbientLoop = {
  src: "/videos/trenerzy-petla.mp4",
  poster: trenerzyPoster,
  label: "Aleksandra Janosz i Mikołaj Mazur w tańcu",
};
