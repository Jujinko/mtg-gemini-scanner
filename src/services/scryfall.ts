export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  image_uris?: {
    normal: string;
    small: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal: string;
    };
  }>;
  prices: {
    usd: string | null;
  };
}

export async function searchScryfallCard(name: string, set?: string): Promise<ScryfallCard | null> {
  try {
    // Clean up the name a bit to help scryfall
    const cleanName = name.replace(/[^a-zA-Z0-9\s,-]/g, '').trim();
    
    // Attempt 1: Exact/Fuzzy search with set (if provided)
    if (set) {
      const q = `!"${cleanName}" set:${set}`;
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) return data.data[0];
      }
    }

    // Attempt 2: Fuzzy named search without set
    const res2 = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}`);
    if (res2.ok) {
      const data = await res2.json();
      return data;
    }

    // Attempt 3: General search as fallback
    const res3 = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cleanName)}`);
    if (res3.ok) {
        const data = await res3.json();
        if (data.data && data.data.length > 0) return data.data[0];
    }

    return null;

  } catch (error) {
    console.error("Scryfall API error:", error);
    return null;
  }
}
