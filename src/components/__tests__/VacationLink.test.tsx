import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 1));
  loadVacation.mockResolvedValue({ member, members: [member], availability: [] });
  saveVacation.mockResolvedValue(undefined);
  clearVacation.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
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
    await userEvent.click(screen.getByRole("button", { name: "2026-11-02" }));
    await userEvent.click(screen.getByRole("button", { name: "2026-11-03" }));
    loadVacation.mockResolvedValue({
      member,
      members: [member],
      availability: [{ member_id: "member", date: "2026-11-02", is_working: false }],
    });
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() =>
      expect(saveVacation).toHaveBeenCalledWith(token, "2026-11-02", "2026-11-03", false)
    );
    expect(await screen.findByText("2026-11-02: Not working")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-11-02" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "2026-11-03" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
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
    await userEvent.click(screen.getByRole("button", { name: "2026-11-02" }));
    await userEvent.click(screen.getByRole("button", { name: "2026-11-03" }));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Availability could not be saved");
  });
  it("does not bypass authentication on the normal vacations page", () => {
    open("/vacations");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(loadVacation).not.toHaveBeenCalled();
  });
  it("shows teammates' vacation names and initials but never exposes their edit controls", async () => {
    const grace = { id: "grace", name: "Grace", role: "frontend" };
    loadVacation.mockResolvedValue({
      member,
      members: [member, grace],
      availability: [
        { member_id: "grace", date: "2026-11-02", is_working: false },
        { member_id: "member", date: "2026-11-03", is_working: false },
      ],
    });
    open();
    await screen.findByRole("heading", { name: "Ada" });
    expect(screen.getByLabelText("Team vacation legend")).toHaveTextContent("Grace");
    expect(screen.getByLabelText("Grace: vacation")).toHaveTextContent("GGrace");
    expect(screen.queryByRole("combobox", { name: "Member" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore calendar default for 2026-11-02" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore calendar default for 2026-11-03" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2026-11-02" }));
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() =>
      expect(saveVacation).toHaveBeenCalledExactlyOnceWith(token, "2026-11-02", "2026-11-02", true)
    );
  });
});
