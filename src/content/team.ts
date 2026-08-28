import type { StaticImageData } from "next/image";
import aleksandra from "@/assets/team/aleksandra.jpg";
import dagmara from "@/assets/team/dagmara.jpg";
import mikolaj from "@/assets/team/mikolaj.jpg";

export type TeamMember = {
  slug: string;
  name: string;
  role: string;
  classInfo: string;
  achievements: string[];
  bio: string[];
  photos: StaticImageData[];
};

export const teamMembers: TeamMember[] = [
  {
    slug: "aleksandra-janosz",
    name: "Aleksandra Janosz",
    role: "Instruktorka",
    classInfo:
      "Najwyższa międzynarodowa klasa taneczna S w tańcach latynoamerykańskich",
    achievements: [
      "II Wicemistrzyni Otwartych Mistrzostw Polski (Polish Open Championships PTT, Zabrze 2024)",
      "Finalistka Mistrzostw Polski",
      "Wielokrotna Mistrzyni Śląska",
      "Finalistka turniejów Grand Prix Polski",
    ],
    bio: [
      "Tańczy od 7. roku życia. Aktywnie rywalizuje na parkietach ogólnopolskich i międzynarodowych.",
      "Na treningach stawia na jakość, technikę i indywidualne podejście. Łączy wytrwałość i perfekcjonizm z pełnym zaangażowaniem — a do tego uśmiech i energię, dzięki którym dzieci, młodzież i dorośli czują się swobodnie.",
    ],
    photos: [aleksandra],
  },
  {
    slug: "mikolaj-mazur",
    name: "Mikołaj Mazur",
    role: "Instruktor",
    classInfo:
      "Najwyższa międzynarodowa klasa S w tańcach latynoamerykańskich",
    achievements: [
      "II Wicemistrz Otwartych Mistrzostw Polski (PTT, Zabrze 2024)",
      "Finalista Mistrzostw Polski",
      "Wielokrotny Mistrz Śląska",
      "Finalista Grand Prix Polski",
    ],
    bio: [
      "Pierwszy duży sukces odniósł w wieku 11 lat — tytuł Wicemistrza Polski. Od 2019 roku tworzy stały duet z Aleksandrą Janosz.",
      "Łączy poziom sportowy z poczuciem humoru i łatwością kontaktu. Ma dar jasnego tłumaczenia techniki i dużo cierpliwości — zajęcia są merytoryczne, zrozumiałe i przyjazne.",
    ],
    photos: [mikolaj],
  },
  {
    slug: "dagmara-janosz",
    name: "Dagmara Janosz",
    role: "Instruktorka",
    classInfo:
      "Najwyższa krajowa klasa A w tańcach standardowych i latynoamerykańskich",
    achievements: [
      "Finalistka Mistrzostw Polski w 10 tańcach",
      "Wielokrotna finalistka Mistrzostw Śląska",
      "Finalistka Grand Prix Polski",
    ],
    bio: [
      "Tańczy od 6. roku życia. Startuje w tańcach standardowych i latynoamerykańskich.",
      "Wnosi na salę pozytywną energię i naturalną radość z ruchu. Łączy ambicję i dyscyplinę treningową z pozytywną atmosferą.",
    ],
    photos: [dagmara],
  },
];
