import { describe, expect, it } from "vitest";
import { bestWindow, mapRegion } from "../../scripts/normalize-media";

describe("bundled media normalisation", () => {
  it("crops a square image to 4:3, centred when there are no regions", () => {
    expect(bestWindow(1024, 1024, [])).toEqual({ left: 0, top: 128, width: 1024, height: 768 });
  });

  it("crops a 3:2 photo to 4:3 horizontally", () => {
    expect(bestWindow(1024, 683, [])).toEqual({ left: 57, top: 0, width: 911, height: 683 });
  });

  it("slides the window to keep clue regions in view", () => {
    // a clue at the very top of a square image
    const win = bestWindow(1000, 1000, [{ x: 0.4, y: 0.0, w: 0.2, h: 0.1 }]);
    expect(win.top).toBe(0);
    expect(win.height).toBe(750);
  });

  it("re-maps regions into the cropped frame", () => {
    const win = { left: 0, top: 125, width: 1000, height: 750 };
    expect(mapRegion({ x: 0.1, y: 0.5, w: 0.2, h: 0.1 }, 1000, 1000, win)).toEqual({ x: 0.1, y: 0.5, w: 0.2, h: 0.133 });
  });

  it("drops regions that mostly fall outside the crop", () => {
    const win = { left: 0, top: 125, width: 1000, height: 750 };
    expect(mapRegion({ x: 0.1, y: 0.0, w: 0.2, h: 0.15 }, 1000, 1000, win)).toBeNull();
    expect(mapRegion({ x: 0.1, y: 0.9, w: 0.2, h: 0.1 }, 1000, 1000, win)).toBeNull();
  });
});
