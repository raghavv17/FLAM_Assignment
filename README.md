# Shape Detector – Final Solution

## Overview

This project is a browser-based **shape detection** app implemented in **TypeScript**.  
Given an image, it detects geometric shapes and classifies them into:

- Circle
- Triangle
- Rectangle (including squares)
- Pentagon
- Star

The UI lets you upload your own images, run detection, and evaluate performance against ground-truth data.

## Tech Stack

- **Language**: TypeScript (compiled to JavaScript)
- **Runtime**: Browser (uses `ImageData`, `<canvas>`, `window`, `document`)
- **Build / Dev Server**: Vite
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js v16+  
- npm (comes with Node)

### Installation

```bash
# Clone the repository
git clone https://github.com/raghavv17/FLAM_Assignment.git
cd FLAM_Assignment

# Install dependencies
npm install
```

### Running the App

```bash
npm run dev
```

Then open the URL shown in the terminal (typically):

```text
http://localhost:5173/
```

In the browser you can:

- Upload any image from your machine.
- Click test images to run detection.
- Right‑click test images and run evaluation on selected images.

## Project Structure

```text
shape-detector/
├── src/
│   ├── main.ts              # App entry + ShapeDetector implementation
│   ├── style.css            # UI styling
│   ├── evaluation.ts        # Evaluation logic (metrics & scoring)
│   ├── evaluation-utils.ts  # Helper functions for metrics (IoU, distances, etc.)
│   ├── evaluation-manager.ts# Wires UI button to evaluation
│   ├── ui-utils.ts          # Modal + selection helpers
│   └── test-images-data.ts  # Embedded test images as data URLs
├── test-images/             # Folder reserved for raw test images (tracked via .gitkeep)
├── expected_results.json    # Expected detection results (mirrors ground_truth.json)
├── ground_truth.json        # Ground-truth annotations used by evaluation
├── index.html               # Main HTML page
├── package.json             # Scripts and dependencies
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Detection Algorithm

The core logic lives in `src/main.ts` inside the `ShapeDetector` class:

- `loadImage(file: File): Promise<ImageData>`  
  Loads an image into an off‑screen canvas and returns its `ImageData`.

- `detectShapes(imageData: ImageData): Promise<DetectionResult>`  
  Main method that performs detection and returns:
  - List of detected shapes
  - Processing time
  - Image dimensions

### High-Level Pipeline

For each image:

1. **Grayscale + Threshold**
   - Convert each pixel to grayscale using a standard luminance formula.
   - Apply a fixed threshold to create a binary mask:
     - 1 = foreground (shape), 0 = background.

2. **Connected-Component Labeling**
   - Scan the binary mask with a 4-connected flood-fill.
   - Each connected blob of `1`s becomes a candidate shape.
   - Skip very small blobs as noise.

3. **Per-Blob Metrics**
   For each blob, compute:
   - **Area**: number of pixels in the blob.
   - **Bounding box**: `x`, `y`, `width`, `height`.
   - **Center**: mean of all pixel coordinates.
   - **Perimeter estimate**: count border pixels (pixels that touch background).
   - **Shape descriptors**:
     - **Circularity**: \(4 \pi A / P^2\), ~1.0 for a perfect circle.
     - **Fill ratio**: `area / (boundingBox.width * boundingBox.height)`.
     - **Aspect ratio**: ratio between width and height of the bounding box.

4. **Classification Heuristics**
   Based on circularity, fill ratio, and aspect ratio:
   - **Circle**:
     - High circularity (close to 1),
     - Bounding box roughly square.
   - **Star**:
     - Lower circularity and relatively low fill ratio (spiky shape).
   - **Triangle / Rectangle / Pentagon**:
     - Discriminated via fill ratio and how tightly the blob fills its bounding box.
     - High fill ratio with near‑square box → rectangle.
     - Lower fill ratios → triangle or pentagon.

   For each shape, the algorithm returns:
   - `type`: `"circle" | "triangle" | "rectangle" | "pentagon" | "star"`
   - `boundingBox`: `{ x, y, width, height }`
   - `center`: `{ x, y }`
   - `area`: pixel count
   - `confidence`: heuristic value in \[0, 1]

5. **Performance Measurement**
   - The method measures `processingTime` using `performance.now()` before and after the pipeline and includes it in the `DetectionResult`.

## Evaluation & Metrics

The repository includes an evaluation flow that compares detections to ground truth in `ground_truth.json` / `expected_results.json`:

- **Module**: `src/evaluation.ts` + `src/evaluation-utils.ts`
- **Metrics**:
  - Precision, recall, F1 score
  - Average IoU (Intersection-over-Union) for bounding boxes
  - Average center-point error (in pixels)
  - Area accuracy
  - Confidence calibration
  - Total processing time

### How to Run Evaluation

1. Start the app: `npm run dev` and open the browser.
2. Scroll to the **Test Images** section.
3. Right‑click images to select them for evaluation.
4. Click **“Run Selected Evaluation”**.
5. A modal appears with:
   - Overall summary metrics.
   - Per-image pass/fail indicators.
   - Feedback sentences describing strengths/weaknesses.

## Notes & Limitations

- The algorithm is purely heuristic and based on simple geometric properties.
- It is designed for **synthetic, high-contrast shapes** (like the provided test images).
- For very noisy or complex real-world images, it may misclassify or miss shapes.
- No external computer vision or ML libraries are used; everything relies on:
  - `ImageData` raw pixels
  - Basic math and geometry
  - Browser APIs (canvas, DOM)

## Author

- GitHub: [@raghavv17](https://github.com/raghavv17)

# Shape Detection Challenge

## Overview

This challenge tests your ability to implement shape detection algorithms that can identify and classify the  geometric shapes in images:

## Setup Instructions

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
shape-detector/
├── src/
│   ├── main.ts          # Main application code (implement here)
│   └── style.css        # Basic styling
├── test-images/         # Test images directory
├── expected_results.json # Expected detection results
├── index.html          # Application UI
└── README.md           # This file
```

## Challenge Requirements

### Primary Task

Implement the `detectShapes()` method in the `ShapeDetector` class located in `src/main.ts`. This method should:

1. Analyze the provided `ImageData` object
2. Detect all geometric shapes present in the image
3. Classify each shape into one of the five required categories
4. Return detection results with specified format

### Implementation Location

```typescript
// File: src/main.ts
async detectShapes(imageData: ImageData): Promise<DetectionResult> {
  // TODO: Implement your shape detection algorithm here
  // This is where you write your code
}
```


## Test Images

The `test-images/` directory contains 10 test images with varying complexity:

1. **Simple shapes** - Clean, isolated geometric shapes
2. **Mixed scenes** - Multiple shapes in single image
3. **Complex scenarios** - Overlapping shapes, noise, rotated shapes
4. **Edge cases** - Very small shapes, partial occlusion
5. **Negative cases** - Images with no detectable shapes

See `expected_results.json` for detailed expected outcomes for each test image.

## Evaluation Criteria

Your implementation will be assessed on:

### 1. Shape Detection Accuracy (40%)

- Correctly identifying all shapes present in test images
- Minimizing false positives (detecting shapes that aren't there)
- Handling various shape sizes, orientations, and positions

### 2. Classification Accuracy (30%)

- Correctly classifying detected shapes into the right categories
- Distinguishing between similar shapes (e.g., square vs. rectangle)
- Handling edge cases and ambiguous shapes

### 3. Precision Metrics (20%)

- **Bounding Box Accuracy**: IoU > 0.7 with expected bounding boxes
- **Center Point Accuracy**: < 10 pixels distance from expected centers
- **Area Calculation**: < 15% error from expected area values
- **Confidence Calibration**: Confidence scores should reflect actual accuracy

### 4. Code Quality & Performance (10%)

- Clean, readable, well-documented code
- Efficient algorithms (< 2000ms processing time per image)
- Proper error handling
                |

## Implementation Guidelines

### Allowed Approaches

- Computer vision algorithms (edge detection, contour analysis)
- Mathematical shape analysis (geometric properties, ratios)
- Pattern recognition techniques
- Image processing operations
- Any algorithm you can implement from scratch

### Constraints

- No external computer vision libraries (OpenCV, etc.)
- Use only browser-native APIs and basic math operations
- No pre-trained machine learning models
- Work with the provided `ImageData` object format


## Testing Your Solution

1. Use the web interface to upload and test images
2. Compare your results with `expected_results.json`
3. Test with the provided test images
4. Verify detection accuracy and confidence scores
5. Check processing time performance

## Submission Guidelines

Your final submission should include:

- Completed implementation in `src/main.ts`
- Any additional helper functions or classes you created
- Brief documentation of your approach (comments in code)
- Test results or performance notes (optional)


