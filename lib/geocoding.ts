// OpenStreetMap Nominatim API — kostenlos, kein API-Key nötig
// Limitierung: Max 1 Request/Sekunde (respektieren!)
export async function geocodePLZ(plz: string, country?: string): Promise<{ lat: number; lng: number; city?: string } | null> {
  if (!plz) return null;
  try {
    const countryCode =
      country === "germany" || country === "de" || country === "DE"
        ? "de"
        : country === "austria" || country === "at" || country === "AT"
        ? "at"
        : country === "switzerland" || country === "ch" || country === "CH"
        ? "ch"
        : "de,at,ch";
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(plz)}&countrycodes=${countryCode}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BNM-App/1.0 (iman.ngo)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Stadt aus display_name extrahieren
    // Typisches Format: "10115, Mitte, Berlin, Deutschland" oder "1010, Wien, Österreich"
    let city: string | undefined;
    const displayName = data[0].display_name;
    if (displayName) {
      const parts = displayName.split(",").map((p: string) => p.trim());
      // Letztes Element ist das Land, erstes oft die PLZ oder der Stadtteil
      // Stadt ist typischerweise das vorletzte oder das zweite Element
      if (parts.length >= 3) {
        // Bei "PLZ, Stadtteil, Stadt, Land" → Stadt ist parts[parts.length - 2]
        // Bei "PLZ, Stadt, Land" → Stadt ist parts[1]
        city = parts[parts.length - 2];
      } else if (parts.length === 2) {
        city = parts[0];
      }
    }

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng), city };
  } catch {
    return null;
  }
}

/**
 * Geocodiert alle User in der profiles-Tabelle, die noch keine lat/lng haben.
 * Respektiert das Nominatim-Rate-Limit (1 Request/s).
 * Gibt die Anzahl der erfolgreich aktualisierten User zurück.
 */
export async function geocodeAllUsers(): Promise<{ success: number; failed: number; total: number }> {
  const { supabase } = await import("./supabase");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, plz, lat, lng")
    .or("lat.is.null,lng.is.null");

  if (error || !profiles) {
    return { success: 0, failed: 0, total: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (!profile.plz) {
      failed++;
      continue;
    }

    const coords = await geocodePLZ(profile.plz);
    if (coords) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ lat: coords.lat, lng: coords.lng })
        .eq("id", profile.id);
      if (updateError) {
        failed++;
      } else {
        success++;
      }
    } else {
      failed++;
    }

    // Rate-Limit: 1 Request/Sekunde
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { success, failed, total: profiles.length };
}
