declare module "upng-js" {
  interface UPNGFrame {
    rect: { x: number; y: number; width: number; height: number };
    delay: number;
    dispose: number;
    blend: number;
  }
  interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UPNGFrame[];
    tabs: Record<string, unknown>;
    data: ArrayBuffer;
  }
  const UPNG: {
    decode(buf: ArrayBuffer): UPNGImage;
    /** One full-canvas RGBA buffer per frame (dispose / blend applied). */
    toRGBA8(img: UPNGImage): ArrayBuffer[];
  };
  export default UPNG;
}
