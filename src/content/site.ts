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

export type Site = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  social: SiteSocial;
  locations: readonly SiteLocation[];
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
} as const satisfies Site;
