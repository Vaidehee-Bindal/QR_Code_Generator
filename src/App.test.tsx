import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("switches between single and batch modes", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText(/enter url/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /batch/i }));
    expect(screen.getByLabelText(/input/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /preview \(\d+\)/i })).toBeInTheDocument();
  });

  it("toggles the document theme", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("shows an error for URL-like input without http or https", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.clear(screen.getByLabelText(/enter url/i));
    await user.type(screen.getByLabelText(/enter url/i), "example.com");

    await waitFor(() => {
      expect(screen.getByLabelText(/enter url/i).closest(".text-field")).toHaveClass("has-error");
    });
  });

  it("resets the single generator form", async () => {
    const user = userEvent.setup();
    render(<App />);

    const urlInput = screen.getByLabelText(/enter url/i);
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.org");
    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect((screen.getByLabelText(/enter url/i) as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(screen.getByText(/no qr/i)).toBeInTheDocument());
  });
});
