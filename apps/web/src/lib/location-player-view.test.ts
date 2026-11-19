import { describe, expect, it } from "vitest";

import { playerLocationView } from "@/lib/location-player-view";

const location = {
  id: "crypt",
  name: "La crypte scellée",
  description: "Le trésor est sous l'autel.",
  imageUrl: "https://example.com/crypt.png",
  hidden: false,
};

describe("playerLocationView", () => {
  it("keeps the map of a visible location", () => {
    expect(playerLocationView(location)).toEqual({
      id: "crypt",
      name: "La crypte scellée",
      imageUrl: "https://example.com/crypt.png",
    });
  });

  it("drops the map of a hidden location", () => {
    expect(playerLocationView({ ...location, hidden: true }).imageUrl).toBeUndefined();
  });

  it("never passes on the GM's description", () => {
    expect(playerLocationView(location)).not.toHaveProperty("description");
  });
});
