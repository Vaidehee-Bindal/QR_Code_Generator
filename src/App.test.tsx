import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("switches between single and batch modes", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText(/enter text \/ url/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /batch/i }));
    expect(screen.getByLabelText(/input/i)).toBeInTheDocument();
    expect(screen.getByText(/Preview \(6\)/i)).toBeInTheDocument();
  });

  it("toggles the document theme", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("shows warnings for suspicious input", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.clear(screen.getByLabelText(/enter text \/ url/i));
    await user.type(screen.getByLabelText(/enter text \/ url/i), "example.com");
    expect(await screen.findByText(/without a protocol/i)).toBeInTheDocument();
  });
});
