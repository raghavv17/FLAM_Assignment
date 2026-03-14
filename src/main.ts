import "./style.css";
import { SelectionManager } from "./ui-utils.js";
import { EvaluationManager } from "./evaluation-manager.js";

export interface Point {
  x: number;
  y: number;
}

export interface DetectedShape {
  type: "circle" | "triangle" | "rectangle" | "pentagon" | "star";
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: Point;
  area: number;
}

export interface DetectionResult {
  shapes: DetectedShape[];
  processingTime: number;
  imageWidth: number;
  imageHeight: number;
}

export class ShapeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  async detectShapes(imageData: ImageData): Promise<DetectionResult> {
    const startTime = performance.now();

    // Basic pipeline:
    // 1) Convert to grayscale and binary mask (foreground vs background)
    // 2) Run connected-component labeling to find distinct blobs
    // 3) For each blob compute area, bounding box, center and simple shape descriptors
    // 4) Classify each blob into circle/triangle/rectangle/pentagon/star

    const { width, height, data } = imageData;

    // Step 1: grayscale + threshold to binary mask
    const binary = new Uint8Array(width * height);
    const threshold = 200; // works well for high-contrast synthetic shapes
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        binary[y * width + x] = gray < threshold ? 1 : 0;
      }
    }

    // Step 2: connected components (4‑connected)
    const labels = new Int32Array(width * height).fill(0);
    const blobs: {
      id: number;
      pixels: Point[];
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }[] = [];
    let currentLabel = 0;

    const stack: Point[] = [];

    const inBounds = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < width && y < height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] === 0 || labels[idx] !== 0) continue;

        currentLabel++;
        const blobPixels: Point[] = [];
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;

        stack.length = 0;
        stack.push({ x, y });
        labels[idx] = currentLabel;

        while (stack.length > 0) {
          const { x: sx, y: sy } = stack.pop() as Point;
          blobPixels.push({ x: sx, y: sy });
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;

          const neighbors = [
            { x: sx + 1, y: sy },
            { x: sx - 1, y: sy },
            { x: sx, y: sy + 1 },
            { x: sx, y: sy - 1 },
          ];

          for (const n of neighbors) {
            if (!inBounds(n.x, n.y)) continue;
            const nIdx = n.y * width + n.x;
            if (binary[nIdx] === 0 || labels[nIdx] !== 0) continue;
            labels[nIdx] = currentLabel;
            stack.push(n);
          }
        }

        // Skip very small blobs (noise)
        if (blobPixels.length < 30) continue;

        blobs.push({
          id: currentLabel,
          pixels: blobPixels,
          minX,
          minY,
          maxX,
          maxY,
        });
      }
    }

    // Step 3 + 4: compute metrics and classify blobs
    const shapes: DetectedShape[] = [];

    for (const blob of blobs) {
      const area = blob.pixels.length;

      // bounding box
      const boxX = blob.minX;
      const boxY = blob.minY;
      const boxW = blob.maxX - blob.minX + 1;
      const boxH = blob.maxY - blob.minY + 1;

      // center (mean of pixel coordinates)
      let sumX = 0;
      let sumY = 0;
      for (const p of blob.pixels) {
        sumX += p.x;
        sumY += p.y;
      }
      const center: Point = {
        x: sumX / area,
        y: sumY / area,
      };

      // estimate perimeter via border pixels
      let perimeter = 0;
      for (const p of blob.pixels) {
        const neighbors = [
          { x: p.x + 1, y: p.y },
          { x: p.x - 1, y: p.y },
          { x: p.x, y: p.y + 1 },
          { x: p.x, y: p.y - 1 },
        ];
        for (const n of neighbors) {
          if (!inBounds(n.x, n.y) || binary[n.y * width + n.x] === 0) {
            perimeter++;
            break;
          }
        }
      }

      // circularity: 4πA / P² -> close to 1 for perfect circle
      const circularity =
        perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;

      // how full is the bounding box
      const boxArea = boxW * boxH;
      const fillRatio = boxArea > 0 ? area / boxArea : 0;
      const aspectRatio = boxW > boxH ? boxW / boxH : boxH / boxW;

      // rough classification based on these descriptors
      let type: DetectedShape["type"] = "rectangle";
      let confidence = 0.6;

      if (circularity > 0.75 && aspectRatio > 0.8) {
        type = "circle";
        confidence = Math.min(0.95, circularity);
      } else if (fillRatio < 0.5 && circularity < 0.5) {
        type = "star";
        confidence = 0.75;
      } else {
        // polygon‑like shapes: distinguish triangle/rectangle/pentagon by fill and aspect
        if (fillRatio < 0.7) {
          type = "triangle";
          confidence = 0.7;
        } else if (fillRatio >= 0.85 && aspectRatio > 0.8) {
          type = "rectangle";
          confidence = 0.85;
        } else {
          type = "pentagon";
          confidence = 0.7;
        }
      }

      shapes.push({
        type,
        confidence,
        boundingBox: {
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
        },
        center,
        area,
      });
    }

    const processingTime = performance.now() - startTime;

    return {
      shapes,
      processingTime,
      imageWidth: imageData.width,
      imageHeight: imageData.height,
    };
  }

  loadImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

class ShapeDetectionApp {
  private detector: ShapeDetector;
  private imageInput: HTMLInputElement;
  private resultsDiv: HTMLDivElement;
  private testImagesDiv: HTMLDivElement;
  private evaluateButton: HTMLButtonElement;
  private evaluationResultsDiv: HTMLDivElement;
  private selectionManager: SelectionManager;
  private evaluationManager: EvaluationManager;

  constructor() {
    const canvas = document.getElementById(
      "originalCanvas"
    ) as HTMLCanvasElement;
    this.detector = new ShapeDetector(canvas);

    this.imageInput = document.getElementById("imageInput") as HTMLInputElement;
    this.resultsDiv = document.getElementById("results") as HTMLDivElement;
    this.testImagesDiv = document.getElementById(
      "testImages"
    ) as HTMLDivElement;
    this.evaluateButton = document.getElementById(
      "evaluateButton"
    ) as HTMLButtonElement;
    this.evaluationResultsDiv = document.getElementById(
      "evaluationResults"
    ) as HTMLDivElement;

    this.selectionManager = new SelectionManager();
    this.evaluationManager = new EvaluationManager(
      this.detector,
      this.evaluateButton,
      this.evaluationResultsDiv
    );

    this.setupEventListeners();
    this.loadTestImages().catch(console.error);
  }

  private setupEventListeners(): void {
    this.imageInput.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.processImage(file);
      }
    });

    this.evaluateButton.addEventListener("click", async () => {
      const selectedImages = this.selectionManager.getSelectedImages();
      await this.evaluationManager.runSelectedEvaluation(selectedImages);
    });
  }

  private async processImage(file: File): Promise<void> {
    try {
      this.resultsDiv.innerHTML = "<p>Processing...</p>";

      const imageData = await this.detector.loadImage(file);
      const results = await this.detector.detectShapes(imageData);

      this.displayResults(results);
    } catch (error) {
      this.resultsDiv.innerHTML = `<p>Error: ${error}</p>`;
    }
  }

  private displayResults(results: DetectionResult): void {
    const { shapes, processingTime } = results;

    let html = `
      <p><strong>Processing Time:</strong> ${processingTime.toFixed(2)}ms</p>
      <p><strong>Shapes Found:</strong> ${shapes.length}</p>
    `;

    if (shapes.length > 0) {
      html += "<h4>Detected Shapes:</h4><ul>";
      shapes.forEach((shape) => {
        html += `
          <li>
            <strong>${
              shape.type.charAt(0).toUpperCase() + shape.type.slice(1)
            }</strong><br>
            Confidence: ${(shape.confidence * 100).toFixed(1)}%<br>
            Center: (${shape.center.x.toFixed(1)}, ${shape.center.y.toFixed(
          1
        )})<br>
            Area: ${shape.area.toFixed(1)}px²
          </li>
        `;
      });
      html += "</ul>";
    } else {
      html +=
        "<p>No shapes detected. Please implement the detection algorithm.</p>";
    }

    this.resultsDiv.innerHTML = html;
  }

  private async loadTestImages(): Promise<void> {
    try {
      const module = await import("./test-images-data.js");
      const testImages = module.testImages;
      const imageNames = module.getAllTestImageNames();

      let html =
        '<h4>Click to upload your own image or use test images for detection. Right-click test images to select/deselect for evaluation:</h4><div class="evaluation-controls"><button id="selectAllBtn">Select All</button><button id="deselectAllBtn">Deselect All</button><span class="selection-info">0 images selected</span></div><div class="test-images-grid">';

      // Add upload functionality as first grid item
      html += `
        <div class="test-image-item upload-item" onclick="triggerFileUpload()">
          <div class="upload-icon">📁</div>
          <div class="upload-text">Upload Image</div>
          <div class="upload-subtext">Click to select file</div>
        </div>
      `;

      imageNames.forEach((imageName) => {
        const dataUrl = testImages[imageName as keyof typeof testImages];
        const displayName = imageName
          .replace(/[_-]/g, " ")
          .replace(/\.(svg|png)$/i, "");
        html += `
          <div class="test-image-item" data-image="${imageName}" 
               onclick="loadTestImage('${imageName}', '${dataUrl}')" 
               oncontextmenu="toggleImageSelection(event, '${imageName}')">
            <img src="${dataUrl}" alt="${imageName}">
            <div>${displayName}</div>
          </div>
        `;
      });

      html += "</div>";
      this.testImagesDiv.innerHTML = html;

      this.selectionManager.setupSelectionControls();

      (window as any).loadTestImage = async (name: string, dataUrl: string) => {
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], name, { type: "image/svg+xml" });

          const imageData = await this.detector.loadImage(file);
          const results = await this.detector.detectShapes(imageData);
          this.displayResults(results);

          console.log(`Loaded test image: ${name}`);
        } catch (error) {
          console.error("Error loading test image:", error);
        }
      };

      (window as any).toggleImageSelection = (
        event: MouseEvent,
        imageName: string
      ) => {
        event.preventDefault();
        this.selectionManager.toggleImageSelection(imageName);
      };

      // Add upload functionality
      (window as any).triggerFileUpload = () => {
        this.imageInput.click();
      };
    } catch (error) {
      this.testImagesDiv.innerHTML = `
        <p>Test images not available. Run 'node convert-svg-to-png.js' to generate test image data.</p>
        <p>SVG files are available in the test-images/ directory.</p>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ShapeDetectionApp();
});
