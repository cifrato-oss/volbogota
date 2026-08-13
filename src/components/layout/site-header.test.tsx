// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("renders one link per configured nav item", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Principal" });

    for (const item of siteConfig.nav) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }

    expect(nav).toBeInTheDocument();
  });
});
