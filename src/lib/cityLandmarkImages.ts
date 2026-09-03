/** Local landmark thumbnails for popular Ethiopian cities (UI only). */
const CITY_LANDMARK_IMAGES: Record<string, string> = {
  "addis ababa": "/images/cities/addis-ababa.png",
  addisababa: "/images/cities/addis-ababa.png",
  "dire dawa": "/images/cities/dire-dawa.png",
  diredawa: "/images/cities/dire-dawa.png",
  mekelle: "/images/cities/mekelle.png",
  makelle: "/images/cities/mekelle.png",
  adama: "/images/cities/adama.png",
  nazret: "/images/cities/adama.png",
  hawassa: "/images/cities/hawassa.png",
  "bahir dar": "/images/cities/bahir-dar.png",
  bahirdar: "/images/cities/bahir-dar.png",
  gondar: "/images/cities/gondar.png",
  dessie: "/images/cities/dessie.png",
  jimma: "/images/cities/jimma.png",
  jijiga: "/images/cities/jijiga.png",
};

/** Fixed popular cities shown in the location picker (order matters). */
export const POPULAR_CITY_CONFIG = [
  {
    displayName: "Addis Ababa",
    image: "/images/cities/addis-ababa.png",
    aliases: ["addis ababa", "addisababa"],
  },
  {
    displayName: "Dire Dawa",
    image: "/images/cities/dire-dawa.png",
    aliases: ["dire dawa", "diredawa"],
  },
  {
    displayName: "Mekelle",
    image: "/images/cities/mekelle.png",
    aliases: ["mekelle", "makelle"],
  },
  {
    displayName: "Adama",
    image: "/images/cities/adama.png",
    aliases: ["adama", "nazret"],
  },
  {
    displayName: "Hawassa",
    image: "/images/cities/hawassa.png",
    aliases: ["hawassa"],
  },
  {
    displayName: "Bahir Dar",
    image: "/images/cities/bahir-dar.png",
    aliases: ["bahir dar", "bahirdar"],
  },
  {
    displayName: "Gondar",
    image: "/images/cities/gondar.png",
    aliases: ["gondar"],
  },
  {
    displayName: "Dessie",
    image: "/images/cities/dessie.png",
    aliases: ["dessie"],
  },
  {
    displayName: "Jimma",
    image: "/images/cities/jimma.png",
    aliases: ["jimma"],
  },
  {
    displayName: "Jijiga",
    image: "/images/cities/jijiga.png",
    aliases: ["jijiga"],
  },
] as const;

function normalizeCityKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCityLandmarkImage(cityName: string, iconUrl?: string | null): string | null {
  const key = normalizeCityKey(cityName);
  if (CITY_LANDMARK_IMAGES[key]) return CITY_LANDMARK_IMAGES[key];
  for (const [name, url] of Object.entries(CITY_LANDMARK_IMAGES)) {
    if (key.includes(name) || name.includes(key)) return url;
  }
  if (iconUrl) return iconUrl;
  return null;
}

export function resolvePopularCityName(
  displayName: string,
  aliases: readonly string[],
  cities: Array<{ name: string }>
): string {
  for (const alias of aliases) {
    const match = cities.find((c) => {
      const key = normalizeCityKey(c.name);
      return key === alias || key.includes(alias) || alias.includes(key);
    });
    if (match) return match.name;
  }
  return displayName;
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
