export type LocationId = "mikolow" | "lubliniec";

export type SiteLocation = {
  id: LocationId;
  city: string;
  address: string;
};

export type SiteSocial = {
  instagram: string;
  facebook: string;
};

export type SiteLegal = {
  name: string;
  address: string;
  nip: string;
  regon: string;
  krs: string;
  court: string;
};

export type Site = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  social: SiteSocial;
  locations: readonly SiteLocation[];
  legal: SiteLegal;
};

export const site = {
  name: "M&A Dancing Art",
  tagline:
    "Szkoła tańca w Mikołowie i Lublińcu — od pierwszych kroków po parkiet.",
  phone: "539 143 200",
  email: "madancingart@gmail.com",
  social: {
    instagram: "https://www.instagram.com/madancingart",
    facebook: "https://www.facebook.com/madancingart",
  },
  locations: [
    {
      id: "mikolow",
      city: "Mikołów",
      address: "ul. Świerkowa 3",
    },
    {
      id: "lubliniec",
      city: "Lubliniec",
      address: "ul. Oleska 85",
    },
  ],
  legal: {
    name: "M&A DANCING ART sp. z o.o.",
    address: "ul. Świerkowa 3, 43-190 Mikołów",
    nip: "6351872355",
    regon: "529571931",
    krs: "0001125382",
    court:
      "Sąd Rejonowy Katowice-Wschód w Katowicach, VIII Wydział Gospodarczy Krajowego Rejestru Sądowego",
  },
} as const satisfies Site;
