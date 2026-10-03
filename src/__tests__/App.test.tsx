import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import "../i18n";

vi.mock("@/data/supabaseClient", () => ({ supabase: null }));
describe("Planner entry", () => {
  it("renders the planning welcome page and explicit configuration error", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole("heading", { name: "Make room for the work ahead." })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("VITE_SUPABASE_URL");
  });
});
