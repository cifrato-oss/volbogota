// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("shows the site name and links back home", () => {
    render(<SiteHeader />);

    expect(screen.getByText(siteConfig.name)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${siteConfig.name} · Inicio` })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the program dates", () => {
    render(<SiteHeader />);

    expect(screen.getByText(siteConfig.eventLabel)).toBeInTheDocument();
  });
});
