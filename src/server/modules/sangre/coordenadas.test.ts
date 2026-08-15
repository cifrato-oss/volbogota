import { describe, expect, it } from "vitest";

import { coordenadasDeUrl } from "./coordenadas";

describe("coordenadasDeUrl", () => {
  it("prefers the pin over the camera", () => {
    // `@` is where the map was centred and `!3d!4d` is where the place is; they
    // differ whenever the map opened off-centre, and it is the place we want.
    const url =
      "https://www.google.com/maps/place/Hospital/@4.5718345,-74.1309637,17z/data=!3m1!4b1!4m6!3m5!1s0x1!8m2!3d4.5716552!4d-74.1286072";
    expect(coordenadasDeUrl(url)).toEqual({ lat: 4.5716552, lng: -74.1286072 });
  });

  it("falls back to the camera when there is no pin", () => {
    expect(coordenadasDeUrl("https://www.google.com/maps/@4.6193758,-74.0921303,15z")).toEqual({
      lat: 4.6193758,
      lng: -74.0921303,
    });
  });

  it("reads a link built by hand", () => {
    expect(coordenadasDeUrl("https://www.google.com/maps/search/?api=1&query=4.65,-74.11")).toEqual(
      { lat: 4.65, lng: -74.11 },
    );
  });

  it("reads it url-encoded too, which is how a browser writes it", () => {
    expect(
      coordenadasDeUrl("https://www.google.com/maps/search/?api=1&query=4.65%2C-74.11"),
    ).toEqual({ lat: 4.65, lng: -74.11 });
  });

  it("has no coordinates for a short link, which is why they get resolved", () => {
    expect(coordenadasDeUrl("https://maps.app.goo.gl/fA5DDxCsjessn5fa6")).toBeNull();
  });

  it("has none for a search by address either", () => {
    expect(
      coordenadasDeUrl("https://www.google.com/maps/search/?api=1&query=Cra.%2032%20%2318-81"),
    ).toBeNull();
  });

  it("rejects a point outside Bogotá rather than placing a pin in the wrong city", () => {
    // A silently wrong pin is worse than none: the donor cannot tell.
    expect(coordenadasDeUrl("https://www.google.com/maps/@40.7128,-74.006,15z")).toBeNull();
    expect(coordenadasDeUrl("https://www.google.com/maps/@4.65,-118.24,15z")).toBeNull();
  });

  it("returns null for anything that is not a maps link", () => {
    expect(coordenadasDeUrl("https://example.com")).toBeNull();
    expect(coordenadasDeUrl("")).toBeNull();
  });
});
