import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VacationLink from "@/pages/vacation-link";
import { EntryGate } from "@/components/EntryGate";

const { loadVacation, saveVacation, clearVacation } = vi.hoisted(() => ({
  loadVacation: vi.fn(),
  saveVacation: vi.fn(),
  clearVacation: vi.fn(),
}));
vi.mock("@/data/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/data/plannerRepository", () => ({
  createPlannerRepository: () => ({ loadVacation, saveVacation, clearVacation }),
}));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ user: null, loading: true, authError: null }),
}));
vi.mock("@/pages/WelcomePage", () => ({
  WelcomePage: () => <h1>Welcome, please sign in</h1>,
}));
const token = "11111111-1111-4111-8111-111111111111";
const member = { id: "member", name: "Ada", role: "backend" };
function open(path = `/vacations/${token}`) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <EntryGate>
          <Routes>
            <Route path="/vacations/:token" element={<VacationLink />} />
          </Routes>
        </EntryGate>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  loadVacation.mockResolvedValue({ member, availability: [] });
  saveVacation.mockResolvedValue(undefined);
  clearVacation.mockResolvedValue(undefined);
});
describe("Anonymous member vacation route", () => {
  it("loads just the token member without waiting for login or showing workspace controls", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
    expect(loadVacation).toHaveBeenCalledWith(token);
    expect(screen.queryByRole("heading", { name: /sign in/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /linked teams/ })).not.toBeInTheDocument();
  });
  it("saves a range with only its vacation token, then refreshes saved overrides", async () => {
    open();
    await screen.findByRole("heading", { name: "Ada" });
    await userEvent.type(screen.getByLabelText("From"), "2026-11-02");
    await userEvent.type(screen.getByLabelText("To"), "2026-11-03");
    loadVacation.mockResolvedValue({
      member,
      availability: [{ member_id: "member", date: "2026-11-02", is_working: false }],
    });
    await userEvent.click(screen.getByRole("button", { name: "Save availability" }));
    await waitFor(() =>
      expect(saveVacation).toHaveBeenCalledWith(token, "2026-11-02", "2026-11-03", false)
    );
    expect(await screen.findByText("2026-11-02: Not working")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Restore calendar default for 2026-11-02" })
    );
    await waitFor(() => expect(clearVacation).toHaveBeenCalledWith(token, "2026-11-02"));
  });
  it("rejects malformed routes and invalid capabilities explicitly instead of showing login", async () => {
    open("/vacations/not-a-token");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid vacation link");
    expect(loadVacation).not.toHaveBeenCalled();
  });
  it("surfaces remote invalid-link and save errors", async () => {
    loadVacation.mockRejectedValueOnce(new Error("Invalid vacation link"));
    const first = open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid vacation link");
    first.unmount();
    saveVacation.mockRejectedValueOnce(new Error("Availability could not be saved"));
    open();
    await screen.findByRole("heading", { name: "Ada" });
    await userEvent.type(screen.getByLabelText("From"), "2026-11-02");
    await userEvent.type(screen.getByLabelText("To"), "2026-11-03");
    await userEvent.click(screen.getByRole("button", { name: "Save availability" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Availability could not be saved");
  });
  it("does not bypass authentication on the normal vacations page", () => {
    open("/vacations");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(loadVacation).not.toHaveBeenCalled();
  });
});
