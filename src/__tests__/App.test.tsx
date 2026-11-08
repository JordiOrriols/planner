import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { platformRepository } from "../data/platform";
import "../i18n";

vi.mock("../data/platform", () => ({
  platformRepository: { workspaces: vi.fn(), roadmap: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());
describe("Planner Access entry", () => {
  it("shows a default-deny workspace directory without password actions", async () => {
    vi.mocked(platformRepository.workspaces).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText(/do not have access/)).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: "Planner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });
  it("surfaces missing Access authentication rather than a Supabase login form", async () => {
    vi.mocked(platformRepository.workspaces).mockRejectedValue(
      new Error("Cloudflare Access token required")
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Cloudflare Access token required");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
