// One mutable object shared by the GSAP timeline (writes) and the 3D frame loop (reads).
export const S = {
  alpha: 0, // panorama opacity
  fly: 0, // 0 photo sits on its filmstrip thumbnail, 1 it fills the viewport
  bend: 0, // 0 flat photo, 1 full sphere
  zoom: 0, // 0 camera outside looking at the photo, 1 standing inside
  grid: 0, // lat/long guide lines
  yaw: 0,
  pitch: 0,
  off: 1, // 1 = scene centred in the editor viewport, 0 = centred on the full stage
  live: false,
  dragYaw: 0,
  dragPitch: 0,
  lastDrag: 0,
  cell: { x: 0, y: 0, w: 1, h: 1 }, // editor viewport rect inside the stage, px
  thumb: { cx: 0, cy: 0, w: 1 }, // the opened thumbnail, px
  stage: { w: 1, h: 1 },
};

export const resetState = () => {
  Object.assign(S, { alpha: 0, fly: 0, bend: 0, zoom: 0, grid: 0, yaw: 0, pitch: 0, off: 1, live: false });
};

// Hotspot DOM nodes, positioned by the 3D frame loop.
export const spotEls: (HTMLElement | null)[] = [];
