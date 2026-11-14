import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import {
  BODY_MODEL_DEFAULT_VIEW,
  BODY_SYSTEM_DEFINITIONS,
  type BodyModelView,
  type BodySystemId,
} from "../../src/shared/src";
import { BodyExplorerVisual } from "../../src/components/BodyExplorerVisual";
import type { BodyModelSceneLoader } from "../../src/components/bodyModel/BodyModelView";
import type { BodyModelSceneOptions } from "../../src/components/bodyModel/bodyModelScene";
import { browserMockBackend, buildDemoSeedInput, desktopBridge } from "../../src/bridge/desktopBridge";
import { App } from "../../src/App";

interface FakeScene {
  canvas: HTMLCanvasElement;
  options: BodyModelSceneOptions;
  selected: BodySystemId[];
  views: BodyModelView[];
  disposed: boolean;
  nextPick: BodySystemId | null;
}

function fakeLoader() {
  const scenes: FakeScene[] = [];
  const loader: BodyModelSceneLoader = async () => ({
    createBodyModelScene: (canvas: HTMLCanvasElement, options: BodyModelSceneOptions) => {
      const s: FakeScene = { canvas, options, selected: [options.selectedId], views: [options.view], disposed: false, nextPick: null };
      scenes.push(s);
      return {
        setSelected: (id: BodySystemId) => void s.selected.push(id),
        setView: (v: BodyModelView) => void s.views.push(v),
        setColors: () => undefined,
        resize: () => undefined,
        pick: () => s.nextPick,
        dispose: () => {
          s.disposed = true;
        },
      };
    },
  });
  return { loader, scenes };
}

/** Mirrors ExplorerRoute: one selection shared by a list and the visual. */
function Harness(props: { loader: BodyModelSceneLoader; support?: "available" | "unavailable" }) {
  const [selected, setSelected] = useState<BodySystemId>("sleep_cognition");
  return (
    <div>
      <div role="group" aria-label="Body systems">
        {BODY_SYSTEM_DEFINITIONS.map((s) => (
          <button key={s.id} type="button" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}>
            {`List ${s.name}`}
          </button>
        ))}
      </div>
      <output data-testid="selected">{selected}</output>
      <BodyExplorerVisual
        selectedId={selected}
        onSelect={setSelected}
        detectSupport={() => props.support ?? "available"}
        loadScene={props.loader}
      />
    </div>
  );
}

function setReducedMotion(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

describe("Health Explorer 3D model", () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => setReducedMotion(false));
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("keeps model regions, region buttons and the list on one selection", async () => {
    const { loader, scenes } = fakeLoader();
    render(<Harness loader={loader} />);
    await waitFor(() => expect(scenes).toHaveLength(1));
    expect(screen.getByRole("button", { name: "3D model" })).toHaveAttribute("aria-pressed", "true");

    // List → model
    fireEvent.click(screen.getByRole("button", { name: "List Cardiovascular" }));
    expect(scenes[0]!.selected.at(-1)).toBe("cardiovascular");
    expect(screen.getByRole("button", { name: /Select Chest: Cardiovascular, Manual observation/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("body-model-caption")).toHaveTextContent("Selected: Chest, Cardiovascular (Manual observation).");

    // Region button → list
    fireEvent.click(screen.getByRole("button", { name: /Select Limbs: Musculoskeletal, Not assessed/ }));
    expect(screen.getByTestId("selected")).toHaveTextContent("musculoskeletal");
    expect(screen.getByRole("button", { name: "List Musculoskeletal" })).toHaveAttribute("aria-pressed", "true");

    // Canvas tap → hit test → shared selection
    const canvas = screen.getByRole("img", { name: /3D anatomical navigation illustration/ });
    scenes[0]!.nextPick = "sleep_cognition";
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50, button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 51, clientY: 50, button: 0, pointerType: "mouse" });
    expect(screen.getByTestId("selected")).toHaveTextContent("sleep_cognition");

    // Whole-body context is selectable without a region and labelled as such
    fireEvent.click(screen.getByRole("button", { name: "List Immune context" }));
    expect(screen.getByTestId("body-model-caption")).toHaveTextContent(/Not assessed · Context only.*Whole-body context/);
  });

  it("rotates on drag without selecting, and resets to the default view", async () => {
    const { loader, scenes } = fakeLoader();
    render(<Harness loader={loader} />);
    await waitFor(() => expect(scenes).toHaveLength(1));
    const canvas = screen.getByRole("img", { name: /3D anatomical navigation illustration/ });
    scenes[0]!.nextPick = "cardiovascular";
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 10, clientY: 10, button: 0, pointerType: "mouse" });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 80, clientY: 10, pointerType: "mouse" });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 80, clientY: 10, button: 0, pointerType: "mouse" });
    expect(screen.getByTestId("selected")).toHaveTextContent("sleep_cognition");
    expect(scenes[0]!.views.length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Rotate left" }));
    expect(scenes[0]!.views.at(-1)).not.toEqual(BODY_MODEL_DEFAULT_VIEW);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(scenes[0]!.views.at(-1)).toEqual(BODY_MODEL_DEFAULT_VIEW);
  });

  it("frees the renderer when the window is hidden or the view is left, and restores it", async () => {
    const { loader, scenes } = fakeLoader();
    const view = render(<Harness loader={loader} />);
    await waitFor(() => expect(scenes).toHaveLength(1));

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(scenes[0]!.disposed).toBe(true);

    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(scenes).toHaveLength(2));
    hidden.mockRestore();
    // A released context is never reused: each renderer gets a new canvas.
    expect(scenes[1]!.canvas).not.toBe(scenes[0]!.canvas);
    expect(scenes[0]!.canvas.isConnected).toBe(false);
    expect(scenes[1]!.canvas.isConnected).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(scenes[1]!.disposed).toBe(true);
    expect(screen.getByRole("group", { name: "Anatomical navigation diagram for body systems" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3D model" }));
    await waitFor(() => expect(scenes).toHaveLength(3));
    view.unmount();
    expect(scenes[2]!.disposed).toBe(true);
  });

  it("falls back to the diagram on renderer load failure and offers a retry", async () => {
    const failing: BodyModelSceneLoader = async () => {
      throw new Error("simulated renderer failure");
    };
    render(<Harness loader={failing} />);
    await screen.findByText(/The 3D model could not be shown/);
    expect(screen.getByRole("group", { name: "Anatomical navigation diagram for body systems" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3D model" })).not.toBeInTheDocument();

    // Every system stays reachable through the diagram and the list.
    fireEvent.click(screen.getByRole("button", { name: "Nutrition & metabolism" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("nutrition_metabolism");
    expect(screen.getByRole("button", { name: "Try the 3D model again" })).toBeInTheDocument();
  });

  it("falls back when the WebGL context is lost", async () => {
    const { loader, scenes } = fakeLoader();
    render(<Harness loader={loader} />);
    await waitFor(() => expect(scenes).toHaveLength(1));
    act(() => scenes[0]!.options.onContextLost());
    expect(await screen.findByText(/The 3D model could not be shown/)).toBeInTheDocument();
    expect(scenes[0]!.disposed).toBe(true);
  });

  it("uses the diagram when graphics are unavailable, without offering the model", () => {
    const { loader, scenes } = fakeLoader();
    render(<Harness loader={loader} support="unavailable" />);
    expect(screen.getByTestId("body-visual-status")).toHaveTextContent(/3D graphics are not available/);
    expect(screen.queryByRole("button", { name: "3D model" })).not.toBeInTheDocument();
    expect(scenes).toHaveLength(0);
  });

  it("starts on the diagram under reduced motion, with the model one click away", async () => {
    setReducedMotion(true);
    const { loader, scenes } = fakeLoader();
    render(<Harness loader={loader} />);
    expect(screen.getByRole("button", { name: "Diagram" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("body-visual-status")).toHaveTextContent(/reduced motion/);
    expect(scenes).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "3D model" }));
    await waitFor(() => expect(scenes).toHaveLength(1));
  });
});

describe("Health Explorer route without WebGL (jsdom)", () => {
  beforeEach(() => {
    browserMockBackend.resetDemo(buildDemoSeedInput(false));
  });

  it("opens a cached research card and offers URL copy after browser failure", async () => {
    const openExternal = vi.spyOn(desktopBridge, "openExternalUrl").mockRejectedValue(new Error("No browser handler"));
    try {
      render(<App />);
      fireEvent.click((await screen.findAllByRole("button", { name: /^Health Explorer$/i }))[0]!);
      fireEvent.click(await screen.findByRole("tab", { name: "Mission context" }));
      fireEvent.click(screen.getByRole("button", { name: "CSA radiation monitoring" }));
      await screen.findByRole("heading", { name: "Monitoring radiation for astronaut health" });
      expect(screen.getByText(/Canadian Space Agency · Version 1/)).toBeInTheDocument();
      expect(screen.getByText(/CrewSignal check-ins leave radiation exposure unassessed/)).toBeInTheDocument();
      expect(openExternal).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Open source URL" }));
      expect(openExternal).toHaveBeenCalledWith("https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp");
      await screen.findByText(/You can copy the source URL/);
      expect(screen.getByRole("button", { name: "Copy source URL" })).toBeInTheDocument();
    } finally {
      openExternal.mockRestore();
    }
  });

  it("keeps the existing list, SVG diagram and detail panel in agreement", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Health Explorer$/i }))[0]!);
    await screen.findByRole("heading", { name: "Health Explorer", level: 1 });
    expect(screen.getByTestId("body-visual-status")).toHaveTextContent(/3D graphics are not available/);
    const list = screen.getByRole("group", { name: "Body systems" });
    fireEvent.click(within(list).getByRole("button", { name: /Musculoskeletal/ }));
    expect(screen.getByRole("heading", { name: "Musculoskeletal", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select Musculoskeletal/ })).toHaveAttribute("aria-pressed", "true");
  });
});
